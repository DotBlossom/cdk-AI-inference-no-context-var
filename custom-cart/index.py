import boto3
import json
from botocore.exceptions import ClientError
import requests

client = boto3.client("bedrock-runtime", region_name="ap-northeast-2")
model_id = "anthropic.claude-3-5-sonnet-20240620-v1:0"  

def handler(event, context):
    
    try:
        body = json.loads(event['body']) 
        # 딕셔너리에서 값 가져오기
        json_input_cart= body["product_metadata_to_str"]  # json.loads() 제거
        customCartId = body["custom_cart_id"]
 
    except KeyError:
        return {
            'statusCode': 400,
            'body': json.dumps({'error': 'json_input_clothes is missing in the request body'}),
            'headers': {
                 "Content-Type": "application/json"
            }
        }

    # 전체 프롬프트 (줄바꿈 추가)
    user_message = f""" {{json_input_cart}} 에 존재하는 상품들의 이름을 중심으로, 상품들의 메타데이터를 통해 조합을 하여, 이 상품들을 대표하는 하나의 문장(제목)을 작성해줘.
    목표는 이 물품들을 구매하는 사용자에게, 물품 정보를 기반으로 사용자가 왜 이러한 물건들을 샀는지에 대한 하나의 구매내역에 대한 기억할만한 문장(제목)을 남기는거야. 
     {json_input_user}의 정보 '성별', '나이' 에 맞게 이러한 제목을 작명해줘.


    {{json_input_cart}} : {json_input_cart}
    {{json_input_user}} : {json_input_user}
    """ 



    conversation = [
        {
            "role": "user",
            "content": [{"text": user_message}],
        }
    ]

    try:
        response = client.converse(
            modelId=model_id,
            messages=conversation,
            # converse에 온도, 최대 토큰, 상위 P, 상위 K 값을 넣습니다.
            inferenceConfig={
                "temperature": 0.7,  
                "maxTokens": 200,  
                "topP": 0.650,     
                
            },
        )

        response_text = response["output"]["message"]["content"][0]["text"]
        print(response_text)
        
        # front 로 결과 전송
        client_url = "" 
        api_url = f"{client_url}{customCartId}"  
        headers = {'Content-Type': 'application/json'}
        response = requests.post(api_url, headers=headers, data=response_text)
        
        # API Gateway 응답 확인
        if response.status_code == 200:
            print("API Controller 요청 후 데이터 저장 성공")
        else:
            print(f"API Controller 요청 후 처리 실패: {response.status_code}, {response.text}")

     
    except (ClientError, Exception) as e:
        print(f"ERROR: Can't invoke '{model_id}'. Reason: {e}")
        exit(1)



    return {
        'statusCode': 200,
        'body': json.dumps({
            'response_text': response_text
        }),
        'headers': {
             "Content-Type": "application/json"
        }
    }
    
    
