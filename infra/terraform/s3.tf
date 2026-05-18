resource "aws_s3_bucket" "assets" {
  bucket = "${var.project}-${var.environment}-assets"
  tags   = local.tags
}

resource "aws_s3_bucket_versioning" "assets" {
  bucket = aws_s3_bucket.assets.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "assets" {
  bucket = aws_s3_bucket.assets.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "assets" {
  bucket = aws_s3_bucket.assets.id

  rule {
    id     = "actor-layers"
    status = "Enabled"
    filter { prefix = "actors/" }
    noncurrent_version_expiration { noncurrent_days = 30 }
  }

  rule {
    id     = "datasets-ia"
    status = "Enabled"
    filter { prefix = "datasets/" }
    transition {
      days          = 90
      storage_class = "STANDARD_IA"
    }
  }

  rule {
    id     = "kv-ia"
    status = "Enabled"
    filter { prefix = "kv/" }
    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "assets" {
  bucket                  = aws_s3_bucket.assets.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_ecr_repository" "services" {
  for_each = toset([
    "web", "api-gateway", "auth-service", "execution-engine",
    "billing-service", "storage-service", "marketplace-service",
    "scheduling-service", "browser-service", "proxy-router", "cli"
  ])

  name                 = "${var.project}/${var.environment}/${each.key}"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration { scan_on_push = true }

  tags = local.tags
}

resource "aws_ecr_lifecycle_policy" "services" {
  for_each   = aws_ecr_repository.services
  repository = each.value.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 20 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 20
      }
      action = { type = "expire" }
    }]
  })
}
