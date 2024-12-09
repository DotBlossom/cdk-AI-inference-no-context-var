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
    try:
        
        # API Gateway 이벤트에서 body 파싱
        body = json.loads(event['body']) 

        product_metadata = body["product"] 
        params = body["product_id"]

        # ... (나머지 코드)

    except Exception as e:
        print(f"Error processing event: {e}")
        return {
            'statusCode': 500,
            'body': json.dumps(f"Error processing event: {e}"),
            'headers': {
                 "Content-Type": "application/json"
            },
        }

    productId = int(params)
    
    body = {
        "product_id": productId,
        "product_metadata_to_str" : "product_name : " + product_metadata["product_name"] + '/' +  "product_category : " + product_metadata["product_categoty"] 
    }
    
    try:
        # /ai-api/metadata/product/<int:productId> 엔드포인트로 POST 요청 보내기
        api_ctrl_url = ""   # API Gateway URL
        api_url = f"{api_ctrl_url}{productId}"
        headers = {'Content-Type': 'application/json'}
        data = {"data": product_metadata}  # product_metadata를 data 필드에 담아 전송
        response = requests.post(api_url, headers=headers, json=data, timeout=15)  # json 파라미터 사용

        response.raise_for_status()  # HTTP 오류 발생 시 예외 발생

        print("Metadata saved successfully.")
    except requests.exceptions.RequestException as e:
        print(f"Error sending metadata request: {e}")
        # 오류 처리 - 예: 오류 메시지 반환, 로그 기록, 재시도 등
        return {
            'statusCode': 500,
            'body': json.dumps(f"Error sending metadata request: {e}"),
            'headers': {
                "Content-Type": "application/json"
            },
        }
    
     ######## Lambda 함수 호출 대신 POST 요청 보내기 ########
    
    try:
        # 이 람다 함수의 엔드포인트로 POST 요청 보내기
        lambda_endpoint = ""  # 이 람다 함수의 엔드포인트
        headers = {'Content-Type': 'application/json'}
        response = requests.post(lambda_endpoint, headers=headers, json=body, timeout=15)

        response.raise_for_status()  # HTTP 오류 발생 시 예외 발생

        print("Lambda endpoint called successfully.")
    except requests.exceptions.RequestException as e:
        print(f"Error calling Lambda endpoint: {e}")
        return {
            'statusCode': 500,
            'body': json.dumps(f"Error calling Lambda endpoint: {e}"),
            'headers': {
                "Content-Type": "application/json"
            },
        }
    
    return {
        'statusCode' : 200,
        'body' : json.dumps('Product has been saved and Invoke bedlockInvoker'),
        'headers': {
            "Content-Type": "application/json"
        },
    }
