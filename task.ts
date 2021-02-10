import {  ContainerImage, TaskDefinition, LogDriver, Compatibility } from '@aws-cdk/aws-ecs';
import { Repository } from '@aws-cdk/aws-ecr';
import { App, StackProps, Stack, Duration } from '@aws-cdk/core';

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
    });

    taskDefinition.addContainer("runner", {
      image: ContainerImage.fromEcrRepository(repository),
      memoryReservationMiB: 2048,
      startTimeout: Duration.seconds(10),
      stopTimeout: Duration.seconds(30),
      logging: LogDriver.awsLogs({
        streamPrefix: this.name,
      }),
    });
  }
}
