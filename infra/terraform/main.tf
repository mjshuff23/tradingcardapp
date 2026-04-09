locals {
  profile_bucket_name = coalesce(
    var.profile_bucket_name,
    "${var.project_name}-${var.environment}-profile-images",
  )

  card_bucket_name = coalesce(
    var.card_bucket_name,
    "${var.project_name}-${var.environment}-card-media",
  )

  common_tags = merge(
    {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "Terraform"
      Stack       = "trading-card-storage"
    },
    var.tags,
  )
}

resource "aws_s3_bucket" "profile" {
  bucket = local.profile_bucket_name
  tags   = merge(local.common_tags, { BucketRole = "profile-images" })
}

resource "aws_s3_bucket" "card" {
  bucket = local.card_bucket_name
  tags   = merge(local.common_tags, { BucketRole = "card-media" })
}

resource "aws_s3_bucket_versioning" "profile" {
  bucket = aws_s3_bucket.profile.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_versioning" "card" {
  bucket = aws_s3_bucket.card.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_public_access_block" "profile" {
  bucket = aws_s3_bucket.profile.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_public_access_block" "card" {
  bucket = aws_s3_bucket.card.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_cors_configuration" "profile" {
  bucket = aws_s3_bucket.profile.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD", "PUT", "POST"]
    allowed_origins = var.cors_allowed_origins
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

resource "aws_s3_bucket_cors_configuration" "card" {
  bucket = aws_s3_bucket.card.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD", "PUT", "POST"]
    allowed_origins = var.cors_allowed_origins
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "profile" {
  bucket = aws_s3_bucket.profile.id

  rule {
    id     = "profile-cleanup"
    status = "Enabled"

    filter {
      prefix = "profiles/"
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = var.incomplete_multipart_abort_days
    }

    noncurrent_version_expiration {
      noncurrent_days = var.noncurrent_version_expiration_days
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "card" {
  bucket = aws_s3_bucket.card.id

  rule {
    id     = "card-cleanup"
    status = "Enabled"

    filter {
      prefix = "user-cards/"
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = var.incomplete_multipart_abort_days
    }

    noncurrent_version_expiration {
      noncurrent_days = var.noncurrent_version_expiration_days
    }
  }

  rule {
    id     = "canonical-cleanup"
    status = "Enabled"

    filter {
      prefix = "canonical-cards/"
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = var.incomplete_multipart_abort_days
    }

    noncurrent_version_expiration {
      noncurrent_days = var.noncurrent_version_expiration_days
    }
  }
}

data "aws_iam_policy_document" "app_storage" {
  statement {
    sid = "ListProfileBucket"

    actions = [
      "s3:GetBucketLocation",
      "s3:ListBucket",
    ]

    resources = [aws_s3_bucket.profile.arn]

    condition {
      test     = "StringLike"
      variable = "s3:prefix"
      values   = ["profiles", "profiles/*"]
    }
  }

  statement {
    sid = "ListCardBucket"

    actions = [
      "s3:GetBucketLocation",
      "s3:ListBucket",
    ]

    resources = [aws_s3_bucket.card.arn]

    condition {
      test     = "StringLike"
      variable = "s3:prefix"
      values   = ["user-cards", "user-cards/*", "canonical-cards", "canonical-cards/*"]
    }
  }

  statement {
    sid = "ProfileObjectReadWrite"

    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
    ]

    resources = ["${aws_s3_bucket.profile.arn}/profiles/*"]
  }

  statement {
    sid = "CardObjectReadWrite"

    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
    ]

    resources = [
      "${aws_s3_bucket.card.arn}/user-cards/*",
      "${aws_s3_bucket.card.arn}/canonical-cards/*",
    ]
  }
}
