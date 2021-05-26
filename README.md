# Github Actions Runner ECS stack (EC2)

This project uses [CDK](https://aws.amazon.com/cdk/) to describe and run a ECS stack for hosting GitHub [Self Hosted GitHub Action Runner](https://docs.github.com/en/free-pro-team@latest/actions/hosting-your-own-runners/about-self-hosted-runners). The runner container here comes from [this project](https://github.com/PasseiDireto/gh-runner). However, we believe this pattern is very common and can be used with similar approaches, given a custom task definition and ECS cluster. Further details on motivation, architecture and next steps are displayed on this article.

## Architecture

This stack contains basically two components:
1. ECS Cluster with an EC2 AutoScalingGroup.
1. Task Definition with a [GitHub Self Hosted Runner](https://github.com/PasseiDireto/gh-runner).

## Custom Sysbox AMI

This stack uses a custom AMI to support [sysbox](https://github.com/nestybox/sysbox), so [gh-runner](https://github.com/PasseiDireto/gh-runner) can run without `privileged` mode and no [hacky](https://jpetazzo.github.io/2015/09/03/do-not-use-docker-in-docker-for-ci/) Docker in Docker approaches not suitable for production. Aditional steps (on `userData` at cluster definition) aim to configure and start the needed services. You can learn more about the custom AMI on AWS Console or using awscli:

```shell script
aws ec2 describe-images --filters "Name=name,Values=passeidireto-ecs-sysbox*"
```

## Usage

First, you will need the following environment variables in order to use this stack:
- `ECS_CLUSTER_VPC`: the VPC your cluster should be on
- `ASG_SUBNETS` comma separated list of which subnets from your VPC your instances should be placed. Remember they should be all public, otherwise your cluster will not be able to communicate with the agent and the instances won't be avaiable to receive new tasks.
- `AWS_DEFAULT_ACCOUNT`: your AWS account ID.
- `AWS_DEFAULT_REGION` The region the stack should be deployed to.


With the environment variables all set, you can just run this stack with:

```sh
npx cdk deploy --all --require-approval never
```

## Attach capacityProvider to your cluster

As of now, you need to configure the default [capacityProvider](https://aws.amazon.com/pt/blogs/containers/deep-dive-on-amazon-ecs-cluster-auto-scaling/) via console or aws CLI. AWS does not support CDK Capacity Provider for now.

So you will need to execute the following steps via [AWS CLI](https://docs.aws.amazon.com/pt_br/cli/latest/userguide/install-cliv2.html).

```sh
aws ecs put-cluster-capacity-providers \
    --cluster gh-runner \
    --capacity-providers $capacity_provider_name \
    --default-capacity-provider-strategy capacityProvider=default,weight=1,base=1
```

**Please note that** since only the base stack is handled by CDK, it is not safe to run updates: ASG changes will erase further modifications, such as the CapacityProvider link into the cluster. We intend to handle this better as soon as AWS publishes the missing CDK constructors. 
