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
    const ami = new LookupMachineImage({name: "ubuntu/images/hvm-ssd/ubuntu-focal-20.04-amd64-server-*"}) // 20201026
    const asg = cluster.addCapacity('gh-runner-automanaged', {
      instanceType: InstanceType.of(InstanceClass.T2, InstanceSize.XLARGE),
      machineImage: ami,
      minCapacity: 0,
      maxCapacity: 6,
      taskDrainTime: Duration.minutes(1),
      cooldown: Duration.minutes(1),
      vpcSubnets,
      keyName: "gh-runner",
      blockDevices:[{
        deviceName: "/dev/sda1",
        volume: BlockDeviceVolume.ebs(40)
      }]
    }); 
    asg.addUserData(
      "sudo -s",
      "export TZ=America/Sao_Paulo",
      "apt-get update",
      "apt-get -y install \
        apt-transport-https \
        ca-certificates \
        curl \
        gnupg-agent \
        wget \
        jq \
        software-properties-common \
        git \
        make \
        dkms",
      "curl -fsSL https://download.docker.com/linux/ubuntu/gpg | apt-key add -",
      "apt-key fingerprint 0EBFCD88",
      "add-apt-repository \
        \"deb [arch=amd64] https://download.docker.com/linux/ubuntu \
        $(lsb_release -cs) \
        stable\"",
      "apt-get update",
      "apt-get -y install docker-ce docker-ce-cli containerd.io",
      "git clone https://github.com/toby63/shiftfs-dkms.git shiftfs-dkms",
      "cd shiftfs-dkms && make -f Makefile.dkms",
      "modprobe shiftfs",
      "lsmod | grep shiftfs",
      "service docker start",
      "echo '{\"default-runtime\": \"sysbox-runc\", \"runtimes\": { \"sysbox-runc\": { \"path\": \"/usr/local/sbin/sysbox-runc\" } } }' | jq '.' > /etc/docker/daemon.json",
      "git config --system url.https://github.com/.insteadOf git@github.com:",
      "git clone --recursive git@github.com:nestybox/sysbox.git",
      "cd sysbox",
      "make sysbox",
      "make install",
      "scr/sysbox",
      "service docker restart",
      "usermod -aG docker ubuntu",
      "sh -c \"echo 'net.ipv4.conf.all.route_localnet = 1' >> /etc/sysctl.conf\"",
      "sysctl -p /etc/sysctl.conf",
      "echo iptables-persistent iptables-persistent/autosave_v4 boolean true | debconf-set-selections",
      "echo iptables-persistent iptables-persistent/autosave_v6 boolean true | debconf-set-selections",
      "apt-get -y install iptables-persistent",
      "iptables -t nat -A PREROUTING -p tcp -d 169.254.170.2 --dport 80 -j DNAT --to-destination 127.0.0.1:51679",
      "iptables -t nat -A OUTPUT -d 169.254.170.2 -p tcp -m tcp --dport 80 -j REDIRECT --to-ports 51679",
      "iptables -A INPUT -i eth0 -p tcp --dport 51678 -j DROP",
      "sh -c 'iptables-save > /etc/iptables/rules.v4'",
      "mkdir -p /etc/ecs && touch /etc/ecs/ecs.config",
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

