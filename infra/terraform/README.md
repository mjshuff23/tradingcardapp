# Terraform Storage Scaffold

This directory holds the first AWS-facing infrastructure scaffold for the Trading Card App.

It creates:

- one private S3 bucket for profile images
- one private S3 bucket for card media
- versioning on both buckets
- public-access blocking on both buckets
- CORS configuration for browser upload/read flows
- lifecycle cleanup for incomplete multipart uploads and noncurrent versions
- an IAM policy document output for app-level access to the required prefixes

## Files

- `providers.tf`: Terraform and AWS provider configuration
- `variables.tf`: environment, bucket, CORS, and tagging inputs
- `main.tf`: bucket resources and IAM policy document
- `outputs.tf`: bucket names/ARNs and the generated policy JSON
- `terraform.tfvars.example`: starter values for local customization

## Prefix layout

- profile images: `profiles/`
- user card assets and scans: `user-cards/`
- canonical/reference card assets: `canonical-cards/`

## Local commands

```bash
cp terraform.tfvars.example terraform.tfvars
terraform fmt -recursive
terraform init -backend=false
terraform validate
terraform plan
```

## Wiring back into the app

Set the backend environment variables from Terraform outputs:

- `S3_REGION`
- `S3_PROFILE_BUCKET`
- `S3_CARD_BUCKET`
- `S3_ACCESS_KEY`
- `S3_SECRET_KEY`

`S3_ENDPOINT` is intentionally not part of the AWS example because the backend keeps that optional for local Garage development.
