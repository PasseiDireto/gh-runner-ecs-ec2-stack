import { Cluster, AsgCapacityProvider } from '@aws-cdk/aws-ecs';
import { AutoScalingGroup, BlockDeviceVolume, UpdatePolicy, Monitoring } from '@aws-cdk/aws-autoscaling';
import { Vpc, InstanceType, Subnet, LookupMachineImage } from '@aws-cdk/aws-ec2';
import { App, Stack, StackProps, Duration } from '@aws-cdk/core';

export class ECSCluster extends Stack {
  constructor(scope: App, id: string, props?: StackProps) {
    super(scope, id, props);

    const vpc = Vpc.fromLookup(this, 'default-vpc', {
      vpcId: process.env.ECS_CLUSTER_VPC
    });

    const subnetIds = process.env.ASG_SUBNETS;
    const vcpSubnets = [...vpc.publicSubnets, ...vpc.privateSubnets, ...vpc.isolatedSubnets];
    const subnets = (subnetIds?.split(',') || [])
        .map((subnetId) => vcpSubnets.find((subnet) => subnet.subnetId === subnetId))
        .filter(Boolean) as Subnet[];

    const cluster = new Cluster(this, 'gh-runner', {
      clusterName: 'gh-runner',
      vpc,
      containerInsights: true
     });

    const ami = new LookupMachineImage( { name: 'passeidireto-ecs-sysbox*' });

    const asg: AutoScalingGroup = new AutoScalingGroup(this, 'Asg', {
      vpc,
      autoScalingGroupName: 'gh-runner-automanaged',
      instanceType: new InstanceType('t3.xlarge'),
      machineImage: ami,
      minCapacity: 0,
      maxCapacity: 6,
      cooldown: Duration.seconds(60),
      blockDevices: [{
        deviceName: '/dev/xvda',
        volume: BlockDeviceVolume.ebs(40),
      }],
      vpcSubnets: {
        subnets,
      },
      newInstancesProtectedFromScaleIn: true,
      maxInstanceLifetime: Duration.days(7),
      updatePolicy: UpdatePolicy.replacingUpdate(),
      instanceMonitoring: Monitoring.DETAILED,
      // https://github.com/aws/aws-cdk/issues/11581
      updateType: undefined,
    });

    asg.addUserData(
      'sudo -s',
      '/usr/local/sbin/sysbox',
      'docker restart',
      `echo ECS_CLUSTER=${cluster.clusterName} | tee /etc/ecs/ecs.config`,
      'echo ECS_LOGFILE=/log/ecs-agent.log | tee -a /etc/ecs/ecs.config',
      'echo ECS_AVAILABLE_LOGGING_DRIVERS=[\\"json-file\\",\\"syslog\\",\\"awslogs\\",\\"fluentd\\",\\"none\\"] | tee -a /etc/ecs/ecs.config',
      'echo ECS_ENABLE_AWSLOGS_EXECUTIONROLE_OVERRIDE=true | tee -a /etc/ecs/ecs.config',
      'echo ECS_ENABLE_TASK_IAM_ROLE=true | tee -a /etc/ecs/ecs.config',
      'echo ECS_ENABLE_TASK_IAM_ROLE_NETWORK_HOST=true | tee -a /etc/ecs/ecs.config',
      'echo ECS_DATADIR=/data | tee -a /etc/ecs/ecs.config',
      'echo ECS_AWSVPC_BLOCK_IMDS=true | tee -a /etc/ecs/ecs.config',
      'echo ECS_ENABLE_TASK_ENI=true | tee -a /etc/ecs/ecs.config',
      'curl -o ecs-agent.tar https://s3.us-east-2.amazonaws.com/amazon-ecs-agent-us-east-2/ecs-agent-latest.tar',
      'docker load --input ./ecs-agent.tar',
      'docker run --name ecs-agent --privileged --detach=true --restart=on-failure:10 --volume=/var/run:/var/run --volume=/var/log/ecs/:/log:Z --volume=/var/lib/ecs/data:/data:Z --volume=/etc/ecs:/etc/ecs --net=host --userns=host --runtime=runc --env-file=/etc/ecs/ecs.config amazon/amazon-ecs-agent:latest'
    );

    const capacityProvider = new AsgCapacityProvider(this, 'AsgCapacityProvider', {
      autoScalingGroup: asg,
      enableManagedScaling: true,
      enableManagedTerminationProtection: true,
      targetCapacityPercent: 100,
      capacityProviderName: asg.autoScalingGroupName,
    });

    cluster.addAsgCapacityProvider(capacityProvider);
  }
}

