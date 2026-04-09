output "profile_bucket_name" {
  description = "Bucket name for user profile images."
  value       = aws_s3_bucket.profile.id
}

output "card_bucket_name" {
  description = "Bucket name for card media."
  value       = aws_s3_bucket.card.id
}

output "profile_bucket_arn" {
  description = "ARN for the profile image bucket."
  value       = aws_s3_bucket.profile.arn
}

output "card_bucket_arn" {
  description = "ARN for the card media bucket."
  value       = aws_s3_bucket.card.arn
}

output "backend_storage_env" {
  description = "Suggested backend environment variables for AWS-backed storage."
  value = {
    S3_REGION         = var.aws_region
    S3_PROFILE_BUCKET = aws_s3_bucket.profile.id
    S3_CARD_BUCKET    = aws_s3_bucket.card.id
  }
}

output "app_storage_policy_json" {
  description = "IAM policy JSON for application access scoped to profile and card object prefixes."
  value       = data.aws_iam_policy_document.app_storage.json
}
