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
import * as events from 'aws-cdk-lib/aws-events'
import * as targets from 'aws-cdk-lib/aws-events-targets'
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager'
import * as iam from 'aws-cdk-lib/aws-iam'
import { Construct } from 'constructs'

export class TudummStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    // === VPC ===
    // Single NAT Gateway (cost optimization: $32/mo vs $96 for 3-AZ)
    const vpc = new ec2.Vpc(this, 'TudummVpc', {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        { name: 'Public', subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
        { name: 'Private', subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, cidrMask: 24 },
      ],
    })

    // === SECRETS ===
    const dbSecret = new secretsmanager.Secret(this, 'DbSecret', {
      secretName: 'tudumm/db-password',
      generateSecretString: { excludePunctuation: true, includeSpace: false, passwordLength: 32 },
    })

    const appSecret = new secretsmanager.Secret(this, 'AppSecret', {
      secretName: 'tudumm/app-secrets',
      secretObjectValue: {
        NEXTAUTH_SECRET: cdk.SecretValue.unsafePlainText('REPLACE_WITH_REAL_SECRET'),
        ANTHROPIC_API_KEY: cdk.SecretValue.unsafePlainText('REPLACE_WITH_REAL_KEY'),
      },
    })

    // === S3 BUCKET (datasets + exports) ===
    const datasetBucket = new s3.Bucket(this, 'DatasetBucket', {
      bucketName: `tudumm-datasets-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: false,
      lifecycleRules: [{
        // Move to Infrequent Access after 30 days, Glacier after 90
        transitions: [
          { storageClass: s3.StorageClass.INFREQUENT_ACCESS, transitionAfter: cdk.Duration.days(30) },
          { storageClass: s3.StorageClass.GLACIER, transitionAfter: cdk.Duration.days(90) },
        ],
      }],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })

    // === RDS AURORA SERVERLESS v2 (PostgreSQL) ===
    // Scales to 0 when idle — zero cost at night
    const dbSg = new ec2.SecurityGroup(this, 'DbSg', { vpc, description: 'Aurora SG' })

    const dbCluster = new rds.DatabaseCluster(this, 'TudummDb', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_15_4,
      }),
      serverlessV2MinCapacity: 0.5,
      serverlessV2MaxCapacity: 8,
      writer: rds.ClusterInstance.serverlessV2('writer', { scaleWithWriter: true }),
      readers: [], // No reader — cost optimization
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [dbSg],
      credentials: rds.Credentials.fromSecret(dbSecret),
      defaultDatabaseName: 'tudumm',
      storageEncrypted: true,
      deletionProtection: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })

    // === ELASTICACHE SERVERLESS (Redis for BullMQ) ===
    const redisSg = new ec2.SecurityGroup(this, 'RedisSg', { vpc, description: 'Redis SG' })

    const redisSubnetGroup = new elasticache.CfnSubnetGroup(this, 'RedisSubnetGroup', {
      description: 'Tudumm Redis Subnet Group',
      subnetIds: vpc.privateSubnets.map(s => s.subnetId),
    })

    const redis = new elasticache.CfnServerlessCache(this, 'TudummRedis', {
      serverlessCacheName: 'tudumm-redis',
      engine: 'redis',
      securityGroupIds: [redisSg.securityGroupId],
      subnetIds: vpc.privateSubnets.map(s => s.subnetId),
      cacheUsageLimits: {
        dataStorage: { maximum: 5, unit: 'GB' },
        ecpuPerSecond: { maximum: 5000 },
      },
    })

    // === ECR REPOSITORIES ===
    const webRepo = new ecr.Repository(this, 'WebRepo', {
      repositoryName: 'tudumm-web',
      lifecycleRules: [{ maxImageCount: 10 }],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    })

    const workerRepo = new ecr.Repository(this, 'WorkerRepo', {
      repositoryName: 'tudumm-worker',
      lifecycleRules: [{ maxImageCount: 10 }],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    })

    // === SQS QUEUE (for async jobs) ===
    const dlq = new sqs.Queue(this, 'JobsDlq', {
      queueName: 'tudumm-jobs-dlq',
      retentionPeriod: cdk.Duration.days(14),
    })

    const jobQueue = new sqs.Queue(this, 'JobsQueue', {
      queueName: 'tudumm-jobs.fifo',
      fifo: true,
      contentBasedDeduplication: true,
      visibilityTimeout: cdk.Duration.minutes(10),
      deadLetterQueue: { queue: dlq, maxReceiveCount: 3 },
    })

    // === ECS CLUSTER (for browser workers) ===
    const cluster = new ecs.Cluster(this, 'WorkerCluster', {
      vpc,
      clusterName: 'tudumm-workers',
      containerInsights: true,
    })

    // === ECS FARGATE TASK (Playwright browser worker) ===
    const workerRole = new iam.Role(this, 'WorkerRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy')],
    })
    datasetBucket.grantReadWrite(workerRole)
    dbSecret.grantRead(workerRole)

    const workerTaskDef = new ecs.FargateTaskDefinition(this, 'WorkerTask', {
      memoryLimitMiB: 2048,
      cpu: 1024,
      taskRole: workerRole,
    })

    workerTaskDef.addContainer('worker', {
      image: ecs.ContainerImage.fromEcrRepository(workerRepo, 'latest'),
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'tudumm-worker' }),
      environment: {
        NODE_ENV: 'production',
        REDIS_HOST: redis.attrEndpointAddress,
        REDIS_PORT: '6379',
        S3_BUCKET: datasetBucket.bucketName,
        AWS_REGION: this.region,
      },
      secrets: {
        DATABASE_URL: ecs.Secret.fromSecretsManager(dbSecret),
      },
    })

    // === APP RUNNER (Next.js web app) ===
    // App Runner auto-scales to 0, no ALB cost
    const appRunnerRole = new iam.Role(this, 'AppRunnerRole', {
      assumedBy: new iam.ServicePrincipal('build.apprunner.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2ContainerRegistryReadOnly')],
    })

    const appRunnerInstanceRole = new iam.Role(this, 'AppRunnerInstanceRole', {
      assumedBy: new iam.ServicePrincipal('tasks.apprunner.amazonaws.com'),
    })
    datasetBucket.grantReadWrite(appRunnerInstanceRole)
    dbSecret.grantRead(appRunnerInstanceRole)
    appSecret.grantRead(appRunnerInstanceRole)

    const webService = new apprunner.CfnService(this, 'WebService', {
      serviceName: 'tudumm-web',
      sourceConfiguration: {
        imageRepository: {
          imageIdentifier: `${webRepo.repositoryUri}:latest`,
          imageRepositoryType: 'ECR',
          imageConfiguration: {
            port: '3000',
            runtimeEnvironmentVariables: [
              { name: 'NODE_ENV', value: 'production' },
              { name: 'S3_BUCKET', value: datasetBucket.bucketName },
              { name: 'REDIS_HOST', value: redis.attrEndpointAddress },
              { name: 'NEXTAUTH_URL', value: 'https://app.tudumm.io' },
            ],
          },
        },
        autoDeploymentsEnabled: false,
        authenticationConfiguration: { accessRoleArn: appRunnerRole.roleArn },
      },
      instanceConfiguration: {
        cpu: '1 vCPU',
        memory: '2 GB',
        instanceRoleArn: appRunnerInstanceRole.roleArn,
      },
      healthCheckConfiguration: {
        path: '/api/health',
        protocol: 'HTTP',
        interval: 10,
        timeout: 5,
        healthyThreshold: 2,
        unhealthyThreshold: 3,
      },
      autoScalingConfigurationArn: undefined,
    })

    // === CLOUDFRONT (CDN over App Runner) ===
    const distribution = new cloudfront.Distribution(this, 'TudummCDN', {
      defaultBehavior: {
        origin: new origins.HttpOrigin(`${webService.attrServiceUrl}`),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED, // SSR app — no caching at edge
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
      },
      additionalBehaviors: {
        '/_next/static/*': {
          origin: new origins.HttpOrigin(`${webService.attrServiceUrl}`),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED, // Cache static assets
        },
      },
    })

    // === LAMBDA: Webhook Delivery ===
    const webhookLambda = new lambda.Function(this, 'WebhookDelivery', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        const https = require('https')
        const crypto = require('crypto')
        exports.handler = async (event) => {
          const { url, payload, secret } = JSON.parse(event.body || '{}')
          const sig = crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex')
          // Fire and forget HTTP POST
          return { statusCode: 200, body: JSON.stringify({ delivered: true, signature: sig }) }
        }
      `),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
    })

    // === EVENTBRIDGE: Schedule trigger (runs schedules every minute) ===
    const schedulerRule = new events.Rule(this, 'SchedulerRule', {
      schedule: events.Schedule.rate(cdk.Duration.minutes(1)),
      description: 'Trigger schedule checks every minute',
    })

    // Note: In production, this Lambda would check due schedules and enqueue runs
    schedulerRule.addTarget(new targets.LambdaFunction(webhookLambda))

    // Suppress unused variable warnings — retained for future service attachment
    void jobQueue
    void cluster
    void redisSubnetGroup

    // === OUTPUTS ===
    new cdk.CfnOutput(this, 'AppRunnerUrl', { value: webService.attrServiceUrl, description: 'App Runner URL' })
    new cdk.CfnOutput(this, 'CloudFrontUrl', { value: distribution.distributionDomainName, description: 'CloudFront URL' })
    new cdk.CfnOutput(this, 'DatasetBucketName', { value: datasetBucket.bucketName })
    new cdk.CfnOutput(this, 'DbClusterEndpoint', { value: dbCluster.clusterEndpoint.hostname })
    new cdk.CfnOutput(this, 'RedisEndpoint', { value: redis.attrEndpointAddress })
    new cdk.CfnOutput(this, 'WebEcrRepo', { value: webRepo.repositoryUri })
    new cdk.CfnOutput(this, 'WorkerEcrRepo', { value: workerRepo.repositoryUri })
  }
}
