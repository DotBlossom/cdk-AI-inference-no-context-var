import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';

import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as path from 'node:path';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import { Monitoring } from 'aws-cdk-lib/aws-autoscaling';

interface CdkTestStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
}

export class LambdaRelStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: CdkTestStackProps) {
    super(scope, id, props);


    // construct Atlas Metadata
    const mongoUrl = this.node.tryGetContext('mongoUrl');


    // construct MetaData in AWS
    const certificateArn = this.node.tryGetContext('certificateArn');
    const certificate = acm.Certificate.fromCertificateArn(this, 'Certificate', certificateArn);
    const hostedZoneId = this.node.tryGetContext('hostedZoneId');

    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
      hostedZoneId: hostedZoneId, // Hosted Zone ID로 변경
      zoneName: 'dotblossom.today',
    });


    // Creation Obj contained importd props of VPC 
    const vpc = props?.vpc;

    // Lambda 함수에 대한 IAM 역할
    const lambdaRole = new iam.Role(this, 'lambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonBedrockFullAccess'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonAPIGatewayInvokeFullAccess'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2FullAccess'),// Bedrock 접근 권한 추가
        iam.ManagedPolicy.fromAwsManagedPolicyName('AWSLambda_FullAccess'),
      ]
    });

    // API Gateway 실행 역할에 권한 추가
    const apiGatewayRole = new iam.Role(this, 'apiGatewayRole', {
      assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com'),
    });

    // 모든 Lambda 함수에 대한 호출 권한 부여
    apiGatewayRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('AWSLambda_FullAccess')
    );


    // VPC 접근 권한 추가
    apiGatewayRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonVPCFullAccess')
    );

    // Lambda 함수 생성
    const myLambdaFunction = new lambda.Function(this, 'myLambdaFunction', {
      runtime: lambda.Runtime.PYTHON_3_9,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda'),
      role: lambdaRole,
      functionName: 'myLambdaFunction',
      vpc: vpc,
      timeout: cdk.Duration.seconds(15)
    });

    const lambdaApi = new apigateway.RestApi(this, 'LambdaApi', {
      
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: apigateway.Cors.DEFAULT_HEADERS,
      },
      
    });

    const apiResource = lambdaApi.root.addResource('api');

    // Lambda 함수와 API Gateway 통합
    const lambdaIntegration = new apigateway.LambdaIntegration(myLambdaFunction, {
      credentialsRole: apiGatewayRole,
      proxy: true, 

    });
    
    const lambdaResource = apiResource.addResource('bedrock');
    lambdaResource.addMethod('POST', lambdaIntegration); // GET 메서드 추가


    const mongoLambdaFunction = new lambda.Function(this, 'mongoLambdaFunction ', {
      runtime: lambda.Runtime.PYTHON_3_9,
      handler: 'index.handler',
      
      code: lambda.Code.fromAsset('mongo'),
      role: lambdaRole,
      vpc: vpc,
      environment: {
        MONGODB_URI: mongoUrl,
      },
      timeout: cdk.Duration.seconds(15)
    });


    const mongoLambdaIntegraion = new apigateway.LambdaIntegration(mongoLambdaFunction, {
      proxy:true,
      credentialsRole: apiGatewayRole,
    });

    const mongoLambdaResource = apiResource.addResource('mongo');
    mongoLambdaResource.addMethod('POST', mongoLambdaIntegraion);


  // custom-cart Lambda 함수 생성
    const customCartLambdaFunction = new lambda.Function(this, 'customCartLambdaFunction', {
      runtime: lambda.Runtime.PYTHON_3_9,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('custom-cart'), 
      role: lambdaRole,
      vpc: vpc,
      timeout: cdk.Duration.seconds(5)
    });

    // API Gateway 리소스 생성
    const cartResource = apiResource.addResource('cart');
    const customResource = cartResource.addResource('custom');
    const generateResource = customResource.addResource('generate'); 

    // Lambda 함수와 API Gateway 통합
    const customCartIntegration = new apigateway.LambdaIntegration(customCartLambdaFunction, {
      credentialsRole: apiGatewayRole,
      proxy: true,
    });

    // POST 메서드 추가
    generateResource.addMethod('POST', customCartIntegration);

    
    /*
        const healthCheckFunction = new lambda.Function(this, 'healthCheckFunction', {
          runtime: lambda.Runtime.PYTHON_3_9,
          handler: 'index.handler',
          code: lambda.Code.fromAsset('health'),
          role: lambdaRole,
          vpc: vpc,
        });
    
        const healthCheckLambdaIntegraion = new apigateway.LambdaIntegration(healthCheckFunction);
        const healthCheckResource = apiResource.addResource('health');
        healthCheckResource.addMethod('GET', healthCheckLambdaIntegraion )
    */
    // 도메인 이름 설정




    
    const domainName = new apigateway.DomainName(this, 'DomainName', {
      domainName: 'lambda.dotblossom.today',
      certificate: certificate,
      securityPolicy: apigateway.SecurityPolicy.TLS_1_2,
      endpointType: apigateway.EndpointType.REGIONAL,
    });


    // API 매핑 생성
    new apigateway.BasePathMapping(this, 'BasePathMapping', {
      domainName: domainName,
      restApi: lambdaApi,
    });

    // Route 53 A 레코드 생성
    new route53.ARecord(this, 'lambdaRecord', {
      recordName: 'lambda',
      zone: hostedZone,
      target: route53.RecordTarget.fromAlias(new targets.ApiGatewayDomain(domainName)),
    });

    // Lambda 함수의 리소스 정책 추가
    myLambdaFunction.addPermission('AllowAPIGatewayInvoke', {
      principal: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      sourceArn: lambdaApi.arnForExecuteApi() // API Gateway 실행 ARN
    });

    // Lambda 함수의 리소스 정책 추가
    mongoLambdaFunction.addPermission('AllowAPIGatewayInvoke', {
      principal: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      sourceArn: lambdaApi.arnForExecuteApi() // API Gateway 실행 ARN
    });
    /*
        healthCheckFunction.addPermission('AllowAPIGatewayInvoke', {
          principal: new iam.ServicePrincipal('apigateway.amazonaws.com'),
          sourceArn: lambdaApi.arnForExecuteApi('GET','/api/health', 'prod')
        });
    
    */
    
    // Lambda 함수의 리소스 정책 추가
    customCartLambdaFunction.addPermission('AllowAPIGatewayInvoke', {
      principal: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      sourceArn: lambdaApi.arnForExecuteApi() 
    });
    
    new cdk.CfnOutput(this, 'LambdaFunctionName', {
      value: myLambdaFunction.functionName,
      description: 'runnerLambda'
    });

    new cdk.CfnOutput(this, 'vpcConfig', {
      value: vpc?.vpcId || 'none'

    });
  }
}
