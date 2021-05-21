import { AutoScalingECSTask } from './task';
import { ECSCluster } from './cluster';
import { App } from '@aws-cdk/core';
import * as dotenv from "dotenv";
dotenv.config();

const app = new App();

const env = {
  account: process.env.AWS_DEFAULT_ACCOUNT || process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.AWS_DEFAULT_REGION || process.env.CDK_DEFAULT_REGION,
};

new ECSCluster(app, 'gh-runner-ecs-cluster', {
  env
});

new AutoScalingECSTask(app, 'gh-runner-task', {
   env
});
