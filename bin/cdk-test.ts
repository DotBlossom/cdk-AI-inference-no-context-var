#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { CdkTestStack } from '../lib/cdk-test-stack';
import { LambdaRelStack } from '../lib/lambda-rel-stack';

const app = new cdk.App();
const parent_cdk = new CdkTestStack(app, 'CdkTestStack', {
  env: {account: '', region: 'ap-northeast-2'} 
});

new LambdaRelStack(app, 'LambdaRelStack', { 
  env: {account: '', region: 'ap-northeast-2'}, 
  vpc: parent_cdk.vpc, 
});