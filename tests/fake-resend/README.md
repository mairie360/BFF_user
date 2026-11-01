# Fake Resend (MAIR-552)

Core API ≥ MAIR-522 sends the password e-mails (`POST /auth/forgot_password`) through Resend. The compose stacks of
this BFF run [WireMock](https://wiremock.org/) in place of the Resend API, as Core_API's own stacks do: Core is started
with `RESEND_BASE_URL=http://fake-resend:8080`, so `POST /emails` lands here and is answered `200` with a random id
(`mappings/emails.json`, copied from Core_API's `tests/fake-resend/`: keep both in step).

Read the e-mails Core sent from the host of the dev stack:

```bash
curl -s http://localhost:8025/__admin/requests | jq '.requests[].request.body | fromjson'
```
