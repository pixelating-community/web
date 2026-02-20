GET {{base_url}}/api/t/{{topic_name}}?action=w
HTTP 200
[Captures]
topic_id: jsonpath "$.topic.id"

POST {{base_url}}/api/p
Content-Type: application/json
{
  "topicId": "{{topic_id}}",
  "name": "{{topic_name}}",
  "perspective": "hurl: missing token should fail"
}
HTTP 401
[Asserts]
jsonpath "$.error" == "Invalid token"

POST {{base_url}}/api/p
Content-Type: application/json
{
  "topicId": "{{topic_id}}",
  "name": "{{topic_name}}",
  "token": "{{topic_token}}",
  "perspective": "hurl: token write should pass"
}
HTTP 200
[Asserts]
jsonpath "$.ok" == true

