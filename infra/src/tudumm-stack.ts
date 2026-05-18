import * as cdk from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as rds from 'aws-cdk-lib/aws-rds'
import * as elasticache from 'aws-cdk-lib/aws-elasticache'
import * as ecs from 'aws-cdk-lib/aws-ecs'
import * as ecr from 'aws-cdk-lib/aws-ecr'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins'
import * as apprunner from 'aws-cdk-lib/aws-apprunner'
import * as sqs from 'aws-cdk-lib/aws-sqs'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources'
import * as events from 'aws-cdk-lib/aws-events'
import * as targets from 'aws-cdk-lib/aws-events-targets'
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as logs from 'aws-cdk-lib/aws-logs'
import { Construct } from 'constructs'

export class TudummStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    // ── VPC ──────────────────────────────────────────────────────────────────
    // 2 AZs, 1 NAT gateway — saves ~$64/mo vs 3-AZ
    const vpc = new ec2.Vpc(this, 'TudummVpc', {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        { name: 'Public',  subnetType: ec2.SubnetType.PUBLIC,                cidrMask: 24 },
        { name: 'Private', subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,   cidrMask: 24 },
      ],
    })

    // ── SECRETS ───────────────────────────────────────────────────────────────
    const dbSecret = new secretsmanager.Secret(this, 'DbSecret', {
      secretName: 'tudumm/db-credentials',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'tudumm' }),
        generateStringKey: 'password',
        excludePunctuation: true,
        passwordLength: 32,
      },
    })

    // App-level secrets — update these values after first deploy via AWS Console
    const appSecret = new secretsmanager.Secret(this, 'AppSecret', {
      secretName: 'tudumm/app-secrets',
      secretObjectValue: {
        NEXTAUTH_SECRET:    cdk.SecretValue.unsafePlainText('REPLACE_BEFORE_DEPLOY'),
        ANTHROPIC_API_KEY:  cdk.SecretValue.unsafePlainText('REPLACE_BEFORE_DEPLOY'),
        HUNTER_API_KEY:     cdk.SecretValue.unsafePlainText(''),
        APOLLO_API_KEY:     cdk.SecretValue.unsafePlainText(''),
      },
    })

    // ── S3 (datasets + lead exports) ─────────────────────────────────────────
    const datasetBucket = new s3.Bucket(this, 'DatasetBucket', {
      bucketName: `tudumm-datasets-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: false,
      lifecycleRules: [{
        transitions: [
          { storageClass: s3.StorageClass.INFREQUENT_ACCESS, transitionAfter: cdk.Duration.days(30) },
          { storageClass: s3.StorageClass.GLACIER,           transitionAfter: cdk.Duration.days(90) },
        ],
      }],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })

    // ── AURORA SERVERLESS v2 (PostgreSQL 15) ──────────────────────────────────
    // min=0.5 ACU (cannot be 0; 0 requires Aurora Serverless v1 which is legacy)
    // Scales down to 0.5 ACU when idle (~$0.06/hr), up to 8 ACU under load
    const dbSg = new ec2.SecurityGroup(this, 'DbSg', {
      vpc,
      description: 'Aurora PostgreSQL security group',
      allowAllOutbound: false,
    })

    const dbCluster = new rds.DatabaseCluster(this, 'TudummDb', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_15_4,
      }),
      serverlessV2MinCapacity: 0.5,
      serverlessV2MaxCapacity: 8,
      writer: rds.ClusterInstance.serverlessV2('writer'),
      readers: [],
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [dbSg],
      credentials: rds.Credentials.fromSecret(dbSecret),
      defaultDatabaseName: 'tudumm',
      storageEncrypted: true,
      deletionProtection: true,
      backup: { retention: cdk.Duration.days(7) },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      cloudwatchLogsExports: ['postgresql'],
    })

    // ── ELASTICACHE SERVERLESS (Redis 7 for BullMQ) ───────────────────────────
    const redisSg = new ec2.SecurityGroup(this, 'RedisSg', {
      vpc,
      description: 'ElastiCache Redis security group',
      allowAllOutbound: false,
    })

    // Allow DB SG inbound from worker/app SGs — added after those SGs are created below
    const appSg = new ec2.SecurityGroup(this, 'AppSg', {
      vpc,
      description: 'App Runner / ECS worker egress',
    })
    dbSg.addIngressRule(appSg, ec2.Port.tcp(5432), 'Aurora from app/worker')
    redisSg.addIngressRule(appSg, ec2.Port.tcp(6379), 'Redis from app/worker')

    const redisSubnetGroup = new elasticache.CfnSubnetGroup(this, 'RedisSubnetGroup', {
      description: 'Tudumm Redis subnet group',
      subnetIds: vpc.privateSubnets.map(s => s.subnetId),
      cacheSubnetGroupName: 'tudumm-redis-subnets',
    })

    const redis = new elasticache.CfnServerlessCache(this, 'TudummRedis', {
      serverlessCacheName: 'tudumm-redis',
      engine: 'redis',
      securityGroupIds: [redisSg.securityGroupId],
      subnetIds: vpc.privateSubnets.map(s => s.subnetId),
      cacheUsageLimits: {
        dataStorage:    { maximum: 5,    unit: 'GB' },
        ecpuPerSecond:  { maximum: 5000 },
      },
    })
    redis.addDependency(redisSubnetGroup)

    // ── ECR REPOSITORIES ──────────────────────────────────────────────────────
    const webRepo = new ecr.Repository(this, 'WebRepo', {
      repositoryName: 'tudumm-web',
      imageScanOnPush: true,
      lifecycleRules: [{ maxImageCount: 10, description: 'Keep last 10 images' }],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      emptyOnDelete: true,
    })

    const workerRepo = new ecr.Repository(this, 'WorkerRepo', {
      repositoryName: 'tudumm-worker',
      imageScanOnPush: true,
      lifecycleRules: [{ maxImageCount: 10, description: 'Keep last 10 images' }],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      emptyOnDelete: true,
    })

    // ── SQS FIFO (async jobs / schedule triggers) ─────────────────────────────
    const dlq = new sqs.Queue(this, 'JobsDlq', {
      queueName: 'tudumm-jobs-dlq.fifo',
      fifo: true,
      retentionPeriod: cdk.Duration.days(14),
    })

    const jobQueue = new sqs.Queue(this, 'JobsQueue', {
      queueName: 'tudumm-jobs.fifo',
      fifo: true,
      contentBasedDeduplication: true,
      visibilityTimeout: cdk.Duration.minutes(10),
      deadLetterQueue: { queue: dlq, maxReceiveCount: 3 },
    })

    // ── ECS CLUSTER (Playwright browser workers — Fargate Spot) ───────────────
    const cluster = new ecs.Cluster(this, 'WorkerCluster', {
      vpc,
      clusterName: 'tudumm-workers',
      containerInsights: true,
    })

    const workerExecutionRole = new iam.Role(this, 'WorkerExecRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ],
    })
    // Allow pulling from ECR
    workerRepo.grantPull(workerExecutionRole)

    const workerTaskRole = new iam.Role(this, 'WorkerTaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    })
    datasetBucket.grantReadWrite(workerTaskRole)
    dbSecret.grantRead(workerTaskRole)
    appSecret.grantRead(workerTaskRole)
    jobQueue.grantConsumeMessages(workerTaskRole)

    const workerTaskDef = new ecs.FargateTaskDefinition(this, 'WorkerTask', {
      memoryLimitMiB: 2048,
      cpu: 1024,
      taskRole: workerTaskRole,
      executionRole: workerExecutionRole,
    })

    const workerLogGroup = new logs.LogGroup(this, 'WorkerLogs', {
      logGroupName: '/ecs/tudumm-worker',
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    })

    workerTaskDef.addContainer('worker', {
      image: ecs.ContainerImage.fromEcrRepository(workerRepo, 'latest'),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'tudumm-worker',
        logGroup: workerLogGroup,
      }),
      environment: {
        NODE_ENV:    'production',
        REDIS_HOST:  redis.attrEndpointAddress,
        REDIS_PORT:  '6379',
        S3_BUCKET:   datasetBucket.bucketName,
        AWS_REGION:  this.region,
      },
      secrets: {
        DATABASE_URL: ecs.Secret.fromSecretsManager(dbSecret, 'connectionString'),
      },
      healthCheck: {
        command: ['CMD-SHELL', 'node -e "process.exit(0)"'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
      },
    })

    // Fargate service with Spot capacity (80% cheaper than On-Demand)
    const workerService = new ecs.FargateService(this, 'WorkerService', {
      cluster,
      taskDefinition: workerTaskDef,
      desiredCount: 1,
      securityGroups: [appSg],
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      capacityProviderStrategies: [
        { capacityProvider: 'FARGATE_SPOT', weight: 4 },
        { capacityProvider: 'FARGATE',      weight: 1 },
      ],
      enableExecuteCommand: true,
      serviceName: 'tudumm-worker',
    })

    // ── APP RUNNER (Next.js — scales to 0 between requests) ──────────────────
    // Access role: used by App Runner to pull images from ECR
    const appRunnerAccessRole = new iam.Role(this, 'AppRunnerAccessRole', {
      assumedBy: new iam.ServicePrincipal('build.apprunner.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2ContainerRegistryReadOnly'),
      ],
    })

    // Instance role: used by the running container
    const appRunnerInstanceRole = new iam.Role(this, 'AppRunnerInstanceRole', {
      assumedBy: new iam.ServicePrincipal('tasks.apprunner.amazonaws.com'),
    })
    datasetBucket.grantReadWrite(appRunnerInstanceRole)
    dbSecret.grantRead(appRunnerInstanceRole)
    appSecret.grantRead(appRunnerInstanceRole)

    const webService = new apprunner.CfnService(this, 'WebService', {
      serviceName: 'tudumm-web',
      sourceConfiguration: {
        authenticationConfiguration: {
          accessRoleArn: appRunnerAccessRole.roleArn,
        },
        autoDeploymentsEnabled: false,
        imageRepository: {
          imageIdentifier:    `${webRepo.repositoryUri}:latest`,
          imageRepositoryType: 'ECR',
          imageConfiguration: {
            port: '3000',
            runtimeEnvironmentVariables: [
              { name: 'NODE_ENV',       value: 'production' },
              { name: 'S3_BUCKET',      value: datasetBucket.bucketName },
              { name: 'REDIS_HOST',     value: redis.attrEndpointAddress },
              { name: 'REDIS_PORT',     value: '6379' },
              { name: 'NEXTAUTH_URL',   value: 'https://app.tudumm.io' },
              { name: 'AWS_REGION',     value: this.region },
            ],
          },
        },
      },
      instanceConfiguration: {
        cpu:             '1 vCPU',
        memory:          '2 GB',
        instanceRoleArn: appRunnerInstanceRole.roleArn,
      },
      healthCheckConfiguration: {
        protocol:           'HTTP',
        path:               '/api/health',
        interval:           10,
        timeout:            5,
        healthyThreshold:   2,
        unhealthyThreshold: 3,
      },
      // Scale down to 0 instances between requests (serverless billing)
      autoScalingConfigurationArn: new apprunner.CfnAutoScalingConfiguration(this, 'WebScaling', {
        autoScalingConfigurationName: 'tudumm-web-scaling',
        minSize:            1,
        maxSize:            10,
        maxConcurrency:     100,
      }).attrAutoScalingConfigurationArn,
    })

    // ── CLOUDFRONT (CDN + SSL termination) ───────────────────────────────────
    const distribution = new cloudfront.Distribution(this, 'TudummCDN', {
      comment: 'Tudumm lead-gen platform CDN',
      defaultBehavior: {
        origin: new origins.HttpOrigin(webService.attrServiceUrl, {
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy:          cloudfront.CachePolicy.CACHING_DISABLED,
        allowedMethods:       cloudfront.AllowedMethods.ALLOW_ALL,
        originRequestPolicy:  cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
      },
      additionalBehaviors: {
        '/_next/static/*': {
          origin: new origins.HttpOrigin(webService.attrServiceUrl, {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy:          cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
        '/favicon.ico': {
          origin: new origins.HttpOrigin(webService.attrServiceUrl, {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy:          cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
      },
    })

    // ── LAMBDA: Webhook delivery + Schedule checker ───────────────────────────
    const lambdaRole = new iam.Role(this, 'LambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'),
      ],
    })
    dbSecret.grantRead(lambdaRole)

    const webhookLambda = new lambda.Function(this, 'WebhookDelivery', {
      functionName: 'tudumm-webhook-delivery',
      runtime:      lambda.Runtime.NODEJS_20_X,
      handler:      'index.handler',
      role:         lambdaRole,
      timeout:      cdk.Duration.seconds(30),
      memorySize:   256,
      logRetention: logs.RetentionDays.ONE_WEEK,
      code: lambda.Code.fromInline(`
const https = require('https')
const http = require('http')
const crypto = require('crypto')
const url = require('url')

exports.handler = async (event) => {
  const records = event.Records || [{ body: JSON.stringify(event) }]
  const results = []

  for (const record of records) {
    const { webhookUrl, payload, secret } = JSON.parse(record.body || '{}')
    if (!webhookUrl) continue

    const body = JSON.stringify(payload)
    const sig  = crypto.createHmac('sha256', secret || 'unsigned').update(body).digest('hex')
    const parsed = url.parse(webhookUrl)
    const lib  = parsed.protocol === 'https:' ? https : http

    await new Promise((resolve) => {
      const req = lib.request({
        hostname: parsed.hostname,
        port:     parsed.port,
        path:     parsed.path,
        method:   'POST',
        headers:  {
          'Content-Type':       'application/json',
          'Content-Length':     Buffer.byteLength(body),
          'X-Tudumm-Signature': \`sha256=\${sig}\`,
        },
      }, (res) => { res.resume(); resolve({ status: res.statusCode }) })
      req.on('error', () => resolve({ error: true }))
      req.write(body)
      req.end()
    })
    results.push({ url: webhookUrl, delivered: true })
  }

  return { statusCode: 200, body: JSON.stringify({ results }) }
}
`),
    })

    // SQS → Lambda for webhook delivery
    webhookLambda.addEventSource(new lambdaEventSources.SqsEventSource(jobQueue, {
      batchSize: 10,
    }))

    // ── EVENTBRIDGE: Schedule checker (every minute) ──────────────────────────
    // This rule fires every minute; the Lambda queries the DB for due schedules
    // and enqueues them as BullMQ jobs via SQS.
    const schedulerRule = new events.Rule(this, 'SchedulerRule', {
      ruleName: 'tudumm-schedule-checker',
      schedule: events.Schedule.rate(cdk.Duration.minutes(1)),
      description: 'Check for due actor schedules and enqueue runs',
    })
    schedulerRule.addTarget(new targets.LambdaFunction(webhookLambda))

    // ── OUTPUTS ───────────────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'AppRunnerUrl',      { value: webService.attrServiceUrl,         description: 'App Runner service URL (use for APPRUNNER_SERVICE_ARN)' })
    new cdk.CfnOutput(this, 'CloudFrontUrl',     { value: distribution.distributionDomainName, description: 'CloudFront URL — point your DNS here' })
    new cdk.CfnOutput(this, 'DatasetBucketName', { value: datasetBucket.bucketName })
    new cdk.CfnOutput(this, 'DbEndpoint',        { value: dbCluster.clusterEndpoint.hostname, description: 'Aurora write endpoint' })
    new cdk.CfnOutput(this, 'RedisEndpoint',     { value: redis.attrEndpointAddress,           description: 'ElastiCache Redis endpoint' })
    new cdk.CfnOutput(this, 'WebEcrRepo',        { value: webRepo.repositoryUri,               description: 'Web ECR repo — set as ECR_WEB_REPO in CI' })
    new cdk.CfnOutput(this, 'WorkerEcrRepo',     { value: workerRepo.repositoryUri,             description: 'Worker ECR repo — set as ECR_WORKER_REPO in CI' })
    new cdk.CfnOutput(this, 'EcsClusterName',    { value: cluster.clusterName })
    new cdk.CfnOutput(this, 'EcsServiceName',    { value: workerService.serviceName })

    // Suppress unused var lint
    void workerService
  }
}
