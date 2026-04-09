variable "aws_region" {
  description = "AWS region for the storage buckets."
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project slug used in bucket naming and tags."
  type        = string
  default     = "trading-card-app"
}

variable "environment" {
  description = "Environment name appended to generated resource names."
  type        = string
  default     = "dev"
}

variable "profile_bucket_name" {
  description = "Explicit bucket name for profile images. Leave null to use the generated name."
  type        = string
  default     = null
  nullable    = true
}

variable "card_bucket_name" {
  description = "Explicit bucket name for card media. Leave null to use the generated name."
  type        = string
  default     = null
  nullable    = true
}

variable "cors_allowed_origins" {
  description = "Origins allowed to upload/read through browser CORS flows."
  type        = list(string)
  default = [
    "http://localhost:3000",
  ]
}

variable "noncurrent_version_expiration_days" {
  description = "Days to keep noncurrent object versions before cleanup."
  type        = number
  default     = 30
}

variable "incomplete_multipart_abort_days" {
  description = "Days after which incomplete multipart uploads are aborted."
  type        = number
  default     = 7
}

variable "tags" {
  description = "Additional tags to merge into all resources."
  type        = map(string)
  default     = {}
}
