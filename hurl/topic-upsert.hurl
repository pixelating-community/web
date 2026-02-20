POST {{base_url}}/api/t/a
x-api-key: {{EL_KEY}}
Content-Type: application/json
{
  "name": "{{topic_name}}",
  "token": "{{topic_token}}",
  "locked": {{topic_locked}},
  "emoji": "{{topic_emoji}}"
}
HTTP 200
[Asserts]
jsonpath "$.success" == true
