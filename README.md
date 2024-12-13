# Welcome to your CDK TypeScript project

This is a blank project for CDK development with TypeScript.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

gpu template is added

## Main Stacks
![스크린샷 2024-12-14 083953](https://github.com/user-attachments/assets/1464951c-b514-490d-8bb9-e07dc4a3b1e1)


## Lambda+Gateway Stack 
![스크린샷 2024-12-14 084005](https://github.com/user-attachments/assets/c38a6ca4-6cc7-4a3b-9051-955157f0b233)


## AI cluster abstract
![sts drawio (3)](https://github.com/user-attachments/assets/2d0469cb-7225-4770-bff5-5c478b78177b)


## aws ac
![제목 없는 다이dsdsfa어그램 drawio](https://github.com/user-attachments/assets/9e56f35d-c172-400f-9cb5-787811982364)


## 세팅
  - AI 추론 클러스터 VPC와 mongoDB VPC 피어링
  - 클러스터 VPC에서 실제 피어링단과 상호작용하는 서브넷의 라우팅 테이블을 MongoDB vpc 피어링 속성으로 추가
  - ingress피어링도 추가해야됨, 몽고디비 잘 돌아갈때까지 피어링 말고 기다려
  - 그러한 private Subnet은, AI 추론 전용 API 단과 연결되어있어, 여기서 MongoDB와 유일통신. 중개 API를 모두 모아서 관리


## 상품 정보 -> 임베딩 특성 값으로 추론 및 증강 -> Atlas DB에 저장(Only peering을 통한 접근)
![fafafafs](https://github.com/user-attachments/assets/f36adb21-cdaf-49e9-b5c3-7097a19edb6a)


## 커스텀 장바구니 상품 메타데이터로 제목 생
![asfsf](https://github.com/user-attachments/assets/8162480d-cb4a-40e7-8427-f71724786dd9)


## ad - 2주전 만든 임시자료

![제목 없는 다이어그sfssfsffsf램 drawio](https://github.com/user-attachments/assets/f3a41433-e258-43fc-b110-b88abef06cd0)

  -굳이 넣고싶다면, DB 피어링 AWS 서비스 밖으로 뺴자, 통신구조 더 간단하게 해도 무방함 이젠 .. 

## composer set

![application-composer-CdkTestStack yaml](https://github.com/user-attachments/assets/ebcafea1-178d-4d6a-b221-50f5bc87e055)

![application-composer-LambdaRelStack yaml](https://github.com/user-attachments/assets/40392ef6-59dd-42d1-b40a-7fdd95fe0d6e)

## 모든 origin 에 대한 요청이 모두 유효함 (통신 test 완료): 추후 alb에 inbound 제약조건 활성화
![fafs21](https://github.com/user-attachments/assets/d42b9a47-6659-4c48-85ff-250c518948e9)

