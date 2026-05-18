import * as cdk from 'aws-cdk-lib'
import { TudummStack } from './tudumm-stack'

const app = new cdk.App()
new TudummStack(app, 'TudummStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'ap-south-1', // Mumbai — lowest latency for India
  },
  tags: { project: 'tudumm', environment: 'production' }
})
