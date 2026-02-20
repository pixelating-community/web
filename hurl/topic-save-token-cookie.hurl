GET {{base_url}}/api/t/{{topic_name}}?action=w
HTTP 200
[Captures]
topic_id: jsonpath "$.topic.id"

POST {{base_url}}/api/t/token
Content-Type: application/json
{
  "token": "{{topic_token}}",
  "topicId": "{{topic_id}}",
  "topicName": "{{topic_name}}"
}
HTTP 200
[Asserts]
jsonpath "$.ok" == true

GET {{base_url}}/api/t/{{topic_name}}?action=w
HTTP 200
[Asserts]
jsonpath "$.topic.canAccess" == true

