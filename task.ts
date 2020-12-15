import {  ContainerImage, TaskDefinition, LogDriver, Compatibility, NetworkMode } from '@aws-cdk/aws-ecs';
import { Repository } from '@aws-cdk/aws-ecr';
import { LogGroup, RetentionDays } from '@aws-cdk/aws-logs';
import { App, StackProps, Stack, RemovalPolicy, Duration } from '@aws-cdk/core';

export class AutoScalingECSTask extends Stack {

  name="gh-runner";

  constructor(scope: App, id: string, props?: StackProps) {
    super(scope, id, props);

    const repository = Repository.fromRepositoryName(this, "gh-runner-repo", this.name);
    const taskDefinition = new TaskDefinition(this, `${this.name}-task`, {
      compatibility: Compatibility.EC2,
      cpu: "1024",
      memoryMiB: "2048",
      family: this.name,
      networkMode: NetworkMode.HOST
    });

    taskDefinition.addContainer("runner", {
      image: ContainerImage.fromEcrRepository(repository),
      memoryReservationMiB: 2048,
      startTimeout: Duration.seconds(10),
      stopTimeout: Duration.seconds(30),
      privileged: true,
      logging: LogDriver.awsLogs({
        streamPrefix: this.name,
        multilinePattern: '^INFO|^WARNING|^ERROR',
        logGroup: new LogGroup(this, `${this.name}-lg`, {
          logGroupName: `${this.name}-logs`,
          retention: RetentionDays.TWO_WEEKS,
          removalPolicy: RemovalPolicy.DESTROY
        })
      }),
    });
  }
}
