from pymongo import MongoClient
import os
import json
import boto3
import requests

client = MongoClient(host=os.environ["MONGODB_URI"])


# save ProductId + Metadata , Call Async myLambdaFunction    
def handler(event, context):
    
    invoke_lambda = boto3.client(service_name='lambda', region_name="ap-northeast-2")
    lambda_name = 'myLambdaFunction'
    
    ## path : /<productId> ,  product : {}
    
    product_metadata = event["product"] 
    params = event["productId"] 
    
    productId = int(params)
    
    body = {
        "product_id": productId,
        "product_metadata_to_str" : "product_name : " + product_metadata["product_name"] + '/' +  "product_category : " + product_metadata["product_categoty"] 
    }
    
    try:
        # 엔드포인트로 POST 요청 보내기
        api_ctrl_url = ""  # API Gateway URL
        api_url = f"{api_ctrl_url}{productId}"
        headers = {'Content-Type': 'application/json'}
        data = {"data": product_metadata}  # product_metadata를 data 필드에 담아 전송
        response = requests.post(api_url, headers=headers, json=data)  # json 파라미터 사용

        response.raise_for_status()  # HTTP 오류 발생 시 예외 발생

        print("Metadata saved successfully.")
    except requests.exceptions.RequestException as e:
        print(f"Error sending metadata request: {e}")
        # 오류 처리 - 예: 오류 메시지 반환, 로그 기록, 재시도 등
        return {
            'statusCode': 500,
            'body': json.dumps(f"Error sending metadata request: {e}")
        }
    
    ######## async + SQS DeqOps #################
    
    try:
        invoke_lambda.invoke(FunctionName=lambda_name, 
                              InvocationType="RequestResponse",
                              Payload=json.dumps(body)
                            )
    except Exception as e:
        print(f"Error invoking Lambda function: {e}")

        return {
            'statusCode': 500,
            'body': json.dumps(f"Error invoking Lambda function: {e}")
        }
    
    ######## EOL #################
    
    
    return {
        'statusCode' : 200,
        'body' : json.dumps('Product has been saved and Invoke bedlockInvoker')
    }
