
import json
import boto3


def handler(event,context):
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'response_text': 'health check is available'
        })
    }
