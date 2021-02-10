import {  Cluster } from '@aws-cdk/aws-ecs';
import {  BlockDeviceVolume } from '@aws-cdk/aws-autoscaling';
import {  Vpc, InstanceType, InstanceClass, InstanceSize, Subnet, LookupMachineImage} from '@aws-cdk/aws-ec2';
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
      vpc,
      containerInsights: true
     });
    const ami = new LookupMachineImage( {name: "passeidireto-ecs-sysbox*"})
    const asg = cluster.addCapacity('gh-runner-automanaged', {
      instanceType: InstanceType.of(InstanceClass.T2, InstanceSize.XLARGE),
      machineImage: ami,
      minCapacity: 0,
      maxCapacity: 6,
      taskDrainTime: Duration.minutes(1),
      cooldown: Duration.minutes(1),
      vpcSubnets,
      blockDevices:[{
        deviceName: "/dev/sda1",
        volume: BlockDeviceVolume.ebs(40)
      }]
    }); 
    asg.addUserData(
      "sudo -s",
      "/usr/local/sbin/sysbox",
      "docker restart",
      `echo ECS_CLUSTER=${cluster.clusterName} | tee /etc/ecs/ecs.config`,
      "echo ECS_DATADIR=/data | tee -a /etc/ecs/ecs.config",
      "echo ECS_ENABLE_TASK_IAM_ROLE=true | tee -a /etc/ecs/ecs.config",
      "echo ENABLE_TASK_IAM_ROLE_NETWORK_HOST=true | tee -a /etc/ecs/ecs.config",
      "echo ECS_LOGFILE=/log/ecs-agent.log | tee -a /etc/ecs/ecs.config",
      "echo ECS_AVAILABLE_LOGGING_DRIVERS=[\"json-file\",\"awslogs\"] | tee -a /etc/ecs/ecs.config",
      "echo ECS_LOGLEVEL=info | tee -a /etc/ecs/ecs.config",
      "curl -o ecs-agent.tar https://s3.us-east-2.amazonaws.com/amazon-ecs-agent-us-east-2/ecs-agent-latest.tar",
      "docker load --input ./ecs-agent.tar",
      "docker run --name ecs-agent --privileged --detach=true --restart=on-failure:10 --volume=/var/run:/var/run --volume=/var/log/ecs/:/log:Z --volume=/var/lib/ecs/data:/data:Z --volume=/etc/ecs:/etc/ecs --net=host --userns=host --runtime=runc --env-file=/etc/ecs/ecs.config amazon/amazon-ecs-agent:latest"
      )

  }
}

