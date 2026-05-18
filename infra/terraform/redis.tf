resource "aws_elasticache_subnet_group" "main" {
  name       = "${var.project}-${var.environment}"
  subnet_ids = aws_subnet.private[*].id
  tags       = local.tags
}

resource "aws_security_group" "redis" {
  name        = "${var.project}-${var.environment}-redis"
  description = "ElastiCache Redis security group"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.eks_cluster.id]
  }

  tags = merge(local.tags, { Name = "${var.project}-${var.environment}-redis" })
}

resource "aws_elasticache_replication_group" "main" {
  replication_group_id = "${var.project}-${var.environment}"
  description          = "Tudumm Redis cluster"

  node_type            = var.redis_node_type
  num_cache_clusters   = var.environment == "production" ? 3 : 1
  port                 = 6379

  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.redis.id]

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true

  automatic_failover_enabled = var.environment == "production"
  multi_az_enabled           = var.environment == "production"

  snapshot_retention_limit = var.environment == "production" ? 1 : 0
  snapshot_window          = "05:00-06:00"
  maintenance_window       = "Mon:06:00-Mon:07:00"

  apply_immediately = var.environment != "production"

  tags = local.tags
}
