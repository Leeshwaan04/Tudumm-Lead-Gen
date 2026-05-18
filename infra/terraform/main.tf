terraform {
  required_version = ">= 1.9.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.33"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.16"
    }
  }

  # Recommended: store state in S3 with DynamoDB locking
  # backend "s3" {
  #   bucket         = "tudumm-terraform-state"
  #   key            = "infra/terraform.tfstate"
  #   region         = "us-east-1"
  #   encrypt        = true
  #   dynamodb_table = "tudumm-terraform-locks"
  # }
}

# ─────────────────────────────────────────────
# Provider Configuration
# ─────────────────────────────────────────────

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Environment = var.environment
      Project     = var.project
      ManagedBy   = "terraform"
    }
  }
}

provider "kubernetes" {
  host                   = module.eks.cluster_endpoint
  cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)

  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    args        = ["eks", "get-token", "--cluster-name", module.eks.cluster_name]
  }
}

provider "helm" {
  kubernetes {
    host                   = module.eks.cluster_endpoint
    cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)

    exec {
      api_version = "client.authentication.k8s.io/v1beta1"
      command     = "aws"
      args        = ["eks", "get-token", "--cluster-name", module.eks.cluster_name]
    }
  }
}

# ─────────────────────────────────────────────
# Data Sources
# ─────────────────────────────────────────────

data "aws_caller_identity" "current" {}

data "aws_availability_zones" "available" {
  state = "available"
}

# EKS-optimised AMI — used by EKS managed node groups automatically,
# but referenced here for documentation purposes.
data "aws_ssm_parameter" "eks_ami" {
  name = "/aws/service/eks/optimized-ami/${var.cluster_version}/amazon-linux-2/recommended/image_id"
}

# ─────────────────────────────────────────────
# Local Values
# ─────────────────────────────────────────────

locals {
  account_id = data.aws_caller_identity.current.account_id
  name_prefix = "${var.project}-${var.environment}"

  common_tags = {
    Environment = var.environment
    Project     = var.project
  }
}

# ─────────────────────────────────────────────
# Modules (referencing sibling .tf files)
# ─────────────────────────────────────────────

# VPC — defined in vpc.tf
# EKS — defined in eks.tf
# RDS — defined in rds.tf
# Redis — defined in redis.tf
# S3  — defined in s3.tf
# ECR — defined in ecr.tf
