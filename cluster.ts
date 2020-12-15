import {  Cluster } from '@aws-cdk/aws-ecs';
import {  Vpc, InstanceType, InstanceClass, InstanceSize, Subnet } from '@aws-cdk/aws-ec2';
import {  App, Stack, StackProps, Duration } from '@aws-cdk/core';


export class ECSCluster extends Stack {
  constructor(scope: App, id: string, props?: StackProps) {
    super(scope, id, props);

    const vpc = Vpc.fromLookup(this, 'default-vpc', {
      vpcId: process.env.ECS_CLUSTER_VPC
    });

    const subnets = Array()
    process.env.ASG_SUBNETS?.split(",").forEach(subnetId => {
      // https://github.com/aws/aws-cdk/issues/8301
      const s = Subnet.fromSubnetAttributes(this, subnetId, {subnetId, availabilityZone: "dummy"})
      subnets.push(s)    
    });
    const vpcSubnets = vpc.selectSubnets({subnets})
    const cluster = new Cluster(this, 'gh-runner', {
      clusterName: 'gh-runner',
      vpc, containerInsights: true
     });
    cluster.addCapacity('gh-runner-automanaged', {
      instanceType: InstanceType.of(InstanceClass.T2, InstanceSize.XLARGE),
      minCapacity: 0,
      maxCapacity: 6,
      taskDrainTime: Duration.minutes(1),
      cooldown: Duration.minutes(1),
      vpcSubnets

    }); 

  }
}

