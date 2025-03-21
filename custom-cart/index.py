import boto3
import json


client = boto3.client("bedrock-runtime", region_name="ap-northeast-2")
model_id = "anthropic.claude-3-haiku-20240307-v1:0"  

def handler(event, context):
    
    try:
        body = json.loads(event['body']) 

        json_input_cart= body["custom_cart_data"]
        customCartId = body["custom_cart_id"]
        
        cart_data = str(json_input_cart["custom_cart_product_data"])
        
    except KeyError:
        return {
            'statusCode': 400,
            'body': json.dumps({'error': 'json_input_clothes is missing in the request body'}),
            'headers': {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin" : "*",
                'Access-Control-Allow-Headers': '*',
                'Access-Control-Allow-Methods': '*'
            }
        }
    # 전체 프롬프트 (줄바꿈 추가)
    user_message = f""" {{json_input_cart}} 에 존재하는 상품들의 이름을 중심으로, 상품들의 메타데이터를 통해 조합을 하여, 이 상품들을 대표하는 하나의 문장(제목)을 작성해줘.
    목표는 이 물품들을 구매하는 사용자에게, 물품 정보를 기반으로 사용자가 왜 이러한 물건들을 샀는지에 대한 하나의 구매내역에 대한 기억할만한 문장(제목)을 남기는거야. 
   

    예시 : 막 시작된 겨울을 맞이하는(오늘 날짜가 11월 중순인 경우), 다크 톤의 캐주얼한 드레스 코드(옷의 이름들의 조합으로 추론)
    예시 2: 만약 옷이 여러개라면 (상의, 하의, 모자 등), 이 옷들의 제목을 통해, 옷 조합에 해당되는 패션이름과, 현재 계절 및 상황을 조합하여 이름을 만들어줘 
    
    결론적으로, 하나의 일기장의 문장과 같은 느낌으로 옷들의 정보를 조합해서 문장을 만들어줘,
    한 문장이 최대이고, 문장으로 종결하지말고 단어로 종결해줘.
    절대 상품 이름들을 그대로 나열하지말고, 그 조합으로 나타나는 패션의 스타일을 중심으로 결과 만들어줘
    
    그리고 답변에 대한 결과만 리턴해줘. 
    {{json_input_cart}} : {cart_data}

    
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


    except (Exception) as e:
        print(f"ERROR: Can't invoke '{model_id}'. Reason: {e}")
        exit(1)


    return {
        'statusCode': 200,
        'body': json.dumps({
            'response_text': response_text,
            'custom_cart_id' : customCartId
        }),
        'headers': {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin" : "*",
            'Access-Control-Allow-Headers': '*',
            'Access-Control-Allow-Methods': '*'
        }
    }
    
    
