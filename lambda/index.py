import boto3
import json
from botocore.exceptions import ClientError
import requests

client = boto3.client("bedrock-runtime", region_name="ap-northeast-2")
model_id = "anthropic.claude-3-5-sonnet-20240620-v1:0"  

def handler(event, context):
    
    try:
        # imageURL 빼고 싹다 넣어버림 될듯?
        json_input_clothes = event["body"] 
        # path에서 productId 가져오기
        productId = event["pathParameters"]["productId"] 
 
    except KeyError:
        return {
            'statusCode': 400,
            'body': json.dumps({'error': 'json_input_clothes is missing in the request body'})
        }

    # 전체 프롬프트 (줄바꿈 추가)
    user_message = f"""{{json_clothes_metadata_feature_all}} 는 json 형식이며, 옷의 기본적인 정보를 포함하는 전체 feature 셋이야. 
너는 {{json_input_clothes}}의 정보를 이용하여, {{json_clothes_metadata_feature_all}} 내부의 "clothes" 의 전체 feature 값 중에서, 
{{json_input_clothes}}의 특성을 잘 반영하는 feature값을 선택하여 {{json_clothes_metadata_feature_all}} 과 동일한 양식의 json 데이터를 결과로 리턴해줘. 
{{json_clothes_metadata_feature_all}}의 내부 키 중 하나인 "reinforced_feature_value"는  결과 에삽입되어야 하는 값이며, 
{{json_clothes_metadata_feature_all}}의 "clothes"의 feature 값 들 중에 존재하지 않지만, {{json_input_clothes}}에 존재하는 명시적인 feature 특성이 존재한다면, "reinforced_feature_value"에 추가해줘. 
"tsf_clothes_metadata_vector_concator"는 결과에 존재해야하는 특성이며, 결과에서 생성된 "clothes","reinforced_feature_value"을 참조하여, 옷의 특성을 가질수 있는 8차원 임베딩 벡터값을 생성해줘. 
"tsf_context_dist_vector"는결과에 존재해야하는 특성이며, "clothes","reinforced_feature_value"에 참조되지않았지만, 옷의 명백한 특성을 설명할 수있는 문자열 형식의 설명을 리턴해줘.

 그리고 답변은 json 데이터의 결과만 리턴해줘. 
 그리고 "category"에 해당하는 값(top, pants, skirt)의 종류에 대응되는 "top.()", "pants.()", "skirt.()" 에 맞는 feature를 선택적으로 채워줘.
 예를들어. "category"가 "02top_01blouse" 이면, top.length.type 과 같은 top.으로 시작하는 feature 값을 골라줘
 "top.()", "pants.()", "skirt.()" 로 시작하는 feature를 제외한 나머지 feature들에는 무조건 1개 이상의 값을 채워줘

{{json_clothes_metadata_feature_all}} : "clothes": {{
            "category": [
                "01outer_01coat", 
                "01outer_02jacket", 
                "01outer_03jumper",
                "01outer_04cardigan",
                "02top_01blouse", 
                "02top_02t-shirt", 
                "02top_03sweater", 
                "02top_04shirt", 
                "02top_05vest", 
                "03-1onepiece(dress)", 
                "03-2onepiece(jumpsuite)", 
                "04bottom_01pants", 
                "04bottom_02skirt"
            ],
            "season": ["spring&fall", "summer", "winter"],
              "fiber_composition": ["Cotton", "Hemp", "cellulose fiber Others", "Silk", "Wool", "protein fiber Others", "Viscos rayon", "regenerated fiber Others", "Polyester", "Nylon", "Polyurethane", "synthetic fiber Others"],
              "elasticity": ["none at all", "none", "contain", "contain little", "contain a lot"],
              "transparency": ["none at all", "none", "contain", "contain little", "contain a lot"],
            "isfleece": ["fleece_contain", "fleece_none"],
            "color": ["Black", "White", "Gray", "Red", "Orange", "Pink", "Yellow", "Brown", "Green", "Blue", "Purple", "Beige", "Mixed"],
              "gender": ["male", "female", "both"],
              "category_specification": ["outer","top","onepiece","bottom"],
              "top.length_type": ["crop", "nomal", "long", "midi", "short"],
              "top.sleeve_length_type": ["sleeveless", "short sleeves", "long sleeves"],
              "top.neck_color_design": ["shirts collar", "bow collar", "sailor collar", "shawl collar", "polo collar", "Peter Pan collar", "tailored collar", "Chinese collar", "band collar", "hood", "round neck", "U-neck", "V-neck", "halter neck", "off shoulder", "one shoulder", "square neck", "turtle neck", "boat neck", "cowl neck", "sweetheart neck", "no neckline", "Others"],
              "top.sleeve_design": ["basic sleeve", "ribbed sleeve", "shirt sleeve", "puff sleeve", "cape sleeve", "petal sleeve", "Others"]
              "pant.silhouette": ["skinny", "normal", "wide", "loose", "bell-bottom", "Others"],
              "skirt.design": ["A-line and bell line", "mermaid line", "Others"]
          }},
"reinforced_feature_value" : {{
                                "category" : [""],
                                "fiber_composition":[""],
                                "color": [""],
                                "category_specification": [""],
                                "specification.metadata":[""]
            }},                         
"tsf_clothes_metadata_vector_concator": [""],
"tsf_context_dist_vector": [""]
}}


{{json_input_clothes}} : {json_input_clothes}
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
                "temperature": 0.9,  
                "maxTokens": 2000,  
                "topP": 0.974,     
                
            },
        )

        response_text = response["output"]["message"]["content"][0]["text"]
        print(response_text)
        
        # API Gateway로 결과 전송
        api_gateway_url = "" 
        api_url = f"{api_gateway_url}{productId}"  # productId를 URL에 포함
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
        })
    }