import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as autoscaling from '@aws-cdk/aws-autoscaling';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets';

import { Construct } from 'constructs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { AutoScalingGroup } from 'aws-cdk-lib/aws-autoscaling';

import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { CapacityProviderDependencyAspect } from './aspects/capacity-provider-dependency-aspect';
import { Authorization } from 'aws-cdk-lib/aws-events';

export class CdkTestStack extends cdk.Stack {
  public readonly vpc: ec2.IVpc;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    const certificateArn = this.node.tryGetContext('certificateArn');
    const certificate = acm.Certificate.fromCertificateArn(this, 'Certificate', certificateArn);


    //---------------------------------------------------------------------------
    // VPC
    this.vpc = new ec2.Vpc(this, 'cdk-cluster-VPC', {
      ipAddresses: ec2.IpAddresses.cidr('10.4.0.0/16'),
      enableDnsHostnames: true,
      enableDnsSupport: true,

      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'ingress',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'application-1',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          cidrMask: 24,
          name: 'application-2',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          cidrMask: 24,
          name: 'inference-controller-1',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        }
      ],
    });

    //---------------------------------------------------------------------------
    // ECS

    // ECS Cluster
    const ecsCluster = new ecs.Cluster(this, 'ECS-gpu-based', {
      vpc: this.vpc,
      //containerInsights: true
    });

    const ecsSG = new ec2.SecurityGroup(this, 'SecurityGroupEcsEc2', {
      vpc: this.vpc,
      allowAllOutbound: true,
    });

    const asgRole = new iam.Role(this, 'asgRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'AmazonEc2FullAccess'),
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "AmazonSSMManagedInstanceCore"),
        //iam.ManagedPolicy.fromAwsManagedPolicyName(
        //"CloudWatchAgentServerPolicy"),
      ]
    });
    
    /*
    // IAM for ASG Config this CDK Executor
    const launchTemplate = new ec2.LaunchTemplate(this, 'LaunchTemplate', {
      launchTemplateName: 'gpu-instance-template',
      instanceType: new ec2.InstanceType('g4dn.xlarge'),
      machineImage: ecs.EcsOptimizedImage.amazonLinux2(ecs.AmiHardwareType.GPU),
      userData: ec2.UserData.custom(`
        #!/bin/bash
        echo ECS_CLUSTER=${ecsCluster.clusterName} >> /etc/ecs/ecs.config
        echo "ECS_ENABLE_GPU_SUPPORT=true" >> /etc/ecs/ecs.config
      `),
      securityGroup:ecsSG,
      role: asgRole,
      
      blockDevices: [{
        deviceName: '/dev/xvda',
        volume: ec2.BlockDeviceVolume.ebs(50, {
          encrypted: true,
          volumeType: ec2.EbsDeviceVolumeType.GP3,
        }),
      }],
    });

    */

    const inferAsg = new AutoScalingGroup(this, "inferFleet", {
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.C5, ec2.InstanceSize.XLARGE),
      vpc: this.vpc,
      machineImage: ecs.EcsOptimizedImage.amazonLinux2023(),
      maxCapacity: 2,
      role: asgRole,

    })
    inferAsg.connections.securityGroups[0].addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.allTraffic(),
      'Allow all inbound traffic'
    );
/*
    const embedAsg = new AutoScalingGroup(this, "embedFleet", {
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.LARGE),
      vpc: this.vpc,
      machineImage: ecs.EcsOptimizedImage.amazonLinux2023(),
      maxCapacity: 2,
    })

    embedAsg.connections.securityGroups[0].addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.allTraffic(),
      'Allow all inbound traffic'
    );
*/

    const controllerAsg = new AutoScalingGroup(this, "controllerFleet", {
      vpc: this.vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.C5, ec2.InstanceSize.XLARGE),
      machineImage: ecs.EcsOptimizedImage.amazonLinux2023(),
      maxCapacity: 2,
      
      //axCapacity: 1,
      //desiredCapacity: 1,
      //launchTemplate,
      //spotPrice: "0.27",
    })

    controllerAsg.connections.securityGroups[0].addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.allTraffic(),
      'Allow all inbound traffic'
    );
    //controllerAsg.addSecurityGroup(ecsSG);

    
    const controllerCapacityProvider = new ecs.AsgCapacityProvider(
      this,
      "controllerAsgCapacityProvider", {
      //enableManagedTerminationProtection: false,
      //canContainersAccessInstanceRole: true,
      autoScalingGroup: controllerAsg
    }
    );

    const inferCapacityProvider = new ecs.AsgCapacityProvider(
      this,
      "inferAsgCapacityProvider",
      {
        //enableManagedTerminationProtection: false,
        //canContainersAccessInstanceRole: true,
        autoScalingGroup: inferAsg
      }
    );
/*
    const embedCapacityProvider = new ecs.AsgCapacityProvider(
      this,
      "embedAsgCapacityProvider",
      {
        //enableManagedTerminationProtection: false,
        //canContainersAccessInstanceRole: true,
        autoScalingGroup: embedAsg
      }
    );

    // child Stack Caller

    ecsCluster.addAsgCapacityProvider(embedCapacityProvider);

*/
    ecsCluster.addAsgCapacityProvider(controllerCapacityProvider);
    ecsCluster.addAsgCapacityProvider(inferCapacityProvider);
    // predefallowed

    cdk.Aspects.of(this).add(new CapacityProviderDependencyAspect());
    const ecsExecTaskPolicyStatement = new iam.PolicyStatement({
      actions: [
        "ssmmessages:CreateControlChannel",
        "ssmmessages:CreateDataChannel",
        "ssmmessages:OpenControlChannel",
        "ssmmessages:OpenDataChannel"
      ],
      resources: ['*']
    });


    //---------------------------------------------------------------------------
    // Task Definitions

    const createTaskDefinition = (name: string, containerPort: number, subnet: ec2.SubnetSelection, capacityProvider: ecs.AsgCapacityProvider, ver: number) => {
      const taskDefinition = new ecs.Ec2TaskDefinition(this, `${name}TaskDef`, {
        taskRole: new iam.Role(this, `${name}TaskRole`, {
          assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
          inlinePolicies: {
            ecsExecPolicy: new iam.PolicyDocument({
              statements: [ecsExecTaskPolicyStatement],
            }),
          },
        }),
      });
      const container = taskDefinition.addContainer(`${name}Container`, {
        image: ecs.ContainerImage.fromRegistry(`clauderuxpair/my-flask-app-${ver}`),
        logging: ecs.LogDrivers.awsLogs({
          streamPrefix: `${name}Server`,
          logGroup: new logs.LogGroup(this, `${name}LogGroup`, {
            retention: logs.RetentionDays.INFINITE,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
          }),
        }),
        memoryLimitMiB: 4096,
        environment: {
          MONGO_URL: this.node.tryGetContext('mongoUrl'),
          MONGO_URI: this.node.tryGetContext('mongoUrl'),
          MONGO_URI_HONG: this.node.tryGetContext('mongoUrl'),
          CUSTOM_RUN_HOST:this.node.tryGetContext('CUSTOM_RUN_HOST'),
          CUSTOM_RUN_PORT:this.node.tryGetContext('CUSTOM_RUN_PORT')
        },
      });

      container.addPortMappings({
        containerPort: containerPort,
        hostPort: containerPort,
        protocol: ecs.Protocol.TCP
      });

      const service = new ecs.Ec2Service(this, `${name}Service`, {
        cluster: ecsCluster,
        taskDefinition: taskDefinition,
        healthCheckGracePeriod: cdk.Duration.seconds(600),
        capacityProviderStrategies: [
          {
            capacityProvider: capacityProvider.capacityProviderName,
            base: 1,
            weight: 1,
          },
        ],


      });

      return service;
    };
/*
    const createGpuBasedTaskDefinition = (name: string, containerPort: number, subnet: ec2.SubnetSelection, capacityProvider: ecs.AsgCapacityProvider, ver: number) => {
      // ECS GPU Task
      const gpuTaskExecutionRole = new iam.Role(this, "GpuTaskExecutionRole", {
        roleName: `${name}-gpu-task-execution-role`,
        assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
      });
      gpuTaskExecutionRole.addManagedPolicy(
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AmazonECSTaskExecutionRolePolicy"
        )
      );

      const taskDefinition = new ecs.Ec2TaskDefinition(this, `${name}TaskDef`, {
        taskRole: new iam.Role(this, `${name}TaskRole`, {
          assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
          inlinePolicies: {
            ecsExecPolicy: new iam.PolicyDocument({
              statements: [ecsExecTaskPolicyStatement],
            }),
          },
        }),
        executionRole: gpuTaskExecutionRole,
      });
      const container = taskDefinition.addContainer(`${name}Container`, {
        image: ecs.ContainerImage.fromRegistry(`clauderuxpair/my-flask-app-${ver}`),
        logging: ecs.LogDrivers.awsLogs({
          streamPrefix: `${name}Server`,
          logGroup: new logs.LogGroup(this, `${name}LogGroup`, {
            retention: logs.RetentionDays.INFINITE,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
          }),
        }),
        cpu: 2048,
        memoryReservationMiB: 4096,
        gpuCount: 1,

        environment: {
          MONGO_URL: this.node.tryGetContext('mongoUrl'),
          NVIDIA_DRIVER_CAPABILITIES: "all",
          AWS_REGION: "ap-northeast-2"
        },
      });
      container.addPortMappings({
        containerPort: containerPort,
        hostPort: containerPort,
        protocol: ecs.Protocol.TCP
      });

      const service = new ecs.Ec2Service(this, `${name}Service`, {
        cluster: ecsCluster,
        taskDefinition: taskDefinition,
        enableExecuteCommand: true,
        healthCheckGracePeriod: cdk.Duration.seconds(600),
        capacityProviderStrategies: [
          {
            capacityProvider: capacityProvider.capacityProviderName,
            base: 1,
            weight: 1,
          },

        ],


      });

      return service;
    };
 */
/*

    const embedService = createTaskDefinition('embed', 5001, {
      subnetGroupName: 'application-2', onePerAz: true,
    }, embedCapacityProvider, 2);
*/
    const inferService = createTaskDefinition('infer', 5000, {
      subnetGroupName: 'application-1', onePerAz: true,

    }, inferCapacityProvider, 5);

    const controllerService = createTaskDefinition('controller', 5050, {
      subnetGroupName: 'inference-controller-1', onePerAz: true,
    }, controllerCapacityProvider, 4);

    // 계층 형성


    //(inferCapacityProvider.node.defaultChild as ecs.CfnCapacityProvider).overrideLogicalId('inferAsgCapacityProvider');
    //(embedCapacityProvider.node.defaultChild as ecs.CfnCapacityProvider).overrideLogicalId('embedAsgCapacityProvider');

    // Capacity Provider가 서비스에 의존하도록 설정

    //---------------------------------------------------------------------------

    // ALB
    const alb = new elbv2.ApplicationLoadBalancer(this, 'ALB', {
      vpc: this.vpc,
      internetFacing: true,
      
    });

    const albSecurityGroup = alb.connections.securityGroups[0];
    albSecurityGroup.addEgressRule(ec2.Peer.ipv4(this.vpc.vpcCidrBlock), ec2.Port.allTraffic(), 'Allow outbound traffic to internal services')

    const hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
      domainName: 'dotblossom.today', // Route 53에 등록된 도메인 이름
    });

    const aliasRecord = new route53.ARecord(this, 'AliasRecord', {
      zone: hostedZone,
      target: route53.RecordTarget.fromAlias(new route53Targets.LoadBalancerTarget(alb)),
    });

    aliasRecord.node.addDependency(alb);
/*


    // EmbedTarget 그룹 생성
    const embedTargetGroup = new elbv2.ApplicationTargetGroup(this, 'EmbedTargetGroup', {
      vpc: this.vpc,
      port: 5001,
      targets: [embedService],
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.INSTANCE,
      healthCheck: {
        interval: cdk.Duration.seconds(60), // 60초 간격
        path: "/",
        timeout: cdk.Duration.seconds(50),
        unhealthyThresholdCount: 5, // 5번 실패 시 비정상
        healthyThresholdCount: 2, // 2번 성공 시 정상
      }
    });
*/
    // InferTarget 그룹 생성
    const inferTargetGroup = new elbv2.ApplicationTargetGroup(this, 'InferTargetGroup', {
      vpc: this.vpc,
      port: 5000,
      targets: [inferService],
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.INSTANCE,
      healthCheck: {
        interval: cdk.Duration.seconds(60), // 60초 간격
        path: "/",
        timeout: cdk.Duration.seconds(50),
        unhealthyThresholdCount: 5, // 5번 실패 시 비정상
        healthyThresholdCount: 2, // 2번 성공 시 정상
      }

    });

    const controllerTargetGroup = new elbv2.ApplicationTargetGroup(this, 'ControllerTargetGroup', {
      vpc: this.vpc,
      port: 5050,
      targets: [controllerService],
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.INSTANCE,
      healthCheck: {
        interval: cdk.Duration.seconds(60), // 60초 간격
        path: "/",
        timeout: cdk.Duration.seconds(50),
        unhealthyThresholdCount: 5, // 5번 실패 시 비정상
        healthyThresholdCount: 2, // 2번 성공 시 정상
      },
      

    });

    /*
    const listener = alb.addListener('Listener', {
      port: 80,
      open: true,
    });
    */

    const listener = alb.addListener('Listener', {
      port: 443,
      certificates: [certificate],
    })

    // **HTTP 리스너를 HTTPS로 리디렉션**
    alb.addListener('HttpListener', {
      port: 80,
      defaultAction: elbv2.ListenerAction.redirect({
        protocol: 'HTTPS',
        permanent: true,
      }),
    });
/*


    // EmbedTarget 규칙 추가
    listener.addTargetGroups('EmbedTarget', {
      targetGroups: [embedTargetGroup],
      priority: 2,
      conditions: [elbv2.ListenerCondition.pathPatterns(['/embed', '/embed/*'])]
    });

*/
    // InferTarget 규칙 추가
    listener.addTargetGroups('InferTarget', {
      targetGroups: [inferTargetGroup],
      priority: 1,
      conditions: [elbv2.ListenerCondition.pathPatterns(['/infer-api', '/infer-api/*'])],

    });

    listener.addTargetGroups('ControllerTarget', {
      targetGroups: [controllerTargetGroup],
      priority: 3,
      conditions: [elbv2.ListenerCondition.pathPatterns(['/ai-api', '/ai-api/*'])]
    });


    listener.addAction('defaultAction', {
      action: elbv2.ListenerAction.fixedResponse(404, {
        contentType: 'text/plain',
        messageBody: 'URL Not Found'
      })
    });



    new cdk.CfnOutput(this, 'MyWebServerServiceURL', {
      value: `http://${alb.loadBalancerDnsName}`,
    });
  }
}
