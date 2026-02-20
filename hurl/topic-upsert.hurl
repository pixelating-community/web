POST {{base_url}}/api/t/a
x-api-key: {{EL_KEY}}
Content-Type: application/json
{
  "key": "{{EL_KEY}}",
  "name": "{{topic_name}}",
  "token": "{{topic_token}}",
  "locked": {{topic_locked}},
  "overwrite": true
}
HTTP 200
[Asserts]
jsonpath "$.success" == true
