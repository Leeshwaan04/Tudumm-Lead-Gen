# ─────────────────────────────────────────────
# Tudumm VPC — Multi-AZ with public/private subnets
# ─────────────────────────────────────────────

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name        = "${local.name_prefix}-vpc"
    Environment = var.environment
    Project     = var.project
  }
}

# ── Internet Gateway ──────────────────────────

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name        = "${local.name_prefix}-igw"
    Environment = var.environment
    Project     = var.project
  }
}

# ── Public Subnets ─────────────────────────────

resource "aws_subnet" "public" {
  count = length(var.availability_zones)

  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.public_subnet_cidrs[count.index]
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name                                                   = "${local.name_prefix}-public-${var.availability_zones[count.index]}"
    "kubernetes.io/cluster/${var.cluster_name}"            = "shared"
    "kubernetes.io/role/elb"                               = "1"
    Environment                                            = var.environment
    Project                                                = var.project
  }
}

# ── Private Subnets ────────────────────────────

resource "aws_subnet" "private" {
  count = length(var.availability_zones)

  vpc_id            = aws_vpc.main.id
  cidr_block        = var.private_subnet_cidrs[count.index]
  availability_zone = var.availability_zones[count.index]

  tags = {
    Name                                                   = "${local.name_prefix}-private-${var.availability_zones[count.index]}"
    "kubernetes.io/cluster/${var.cluster_name}"            = "owned"
    "kubernetes.io/role/internal-elb"                      = "1"
    Environment                                            = var.environment
    Project                                                = var.project
  }
}

# ── Elastic IPs for NAT Gateways ──────────────

resource "aws_eip" "nat" {
  count  = length(var.availability_zones)
  domain = "vpc"

  depends_on = [aws_internet_gateway.main]

  tags = {
    Name        = "${local.name_prefix}-nat-eip-${count.index + 1}"
    Environment = var.environment
    Project     = var.project
  }
}

# ── NAT Gateways (one per AZ for HA) ──────────

resource "aws_nat_gateway" "main" {
  count = length(var.availability_zones)

  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  depends_on = [aws_internet_gateway.main]

  tags = {
    Name        = "${local.name_prefix}-nat-${var.availability_zones[count.index]}"
    Environment = var.environment
    Project     = var.project
  }
}

# ── Public Route Table ─────────────────────────

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name        = "${local.name_prefix}-rt-public"
    Environment = var.environment
    Project     = var.project
  }
}

resource "aws_route_table_association" "public" {
  count = length(var.availability_zones)

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# ── Private Route Tables (one per AZ) ─────────

resource "aws_route_table" "private" {
  count  = length(var.availability_zones)
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main[count.index].id
  }

  tags = {
    Name        = "${local.name_prefix}-rt-private-${var.availability_zones[count.index]}"
    Environment = var.environment
    Project     = var.project
  }
}

resource "aws_route_table_association" "private" {
  count = length(var.availability_zones)

  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}

# ── VPC Endpoints (reduce NAT costs) ──────────

resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.main.id
  service_name      = "com.amazonaws.${var.aws_region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = aws_route_table.private[*].id

  tags = {
    Name        = "${local.name_prefix}-vpce-s3"
    Environment = var.environment
    Project     = var.project
  }
}

resource "aws_vpc_endpoint" "ecr_api" {
  vpc_id              = aws_vpc.main.id
  service_name        = "com.amazonaws.${var.aws_region}.ecr.api"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.vpc_endpoints.id]
  private_dns_enabled = true

  tags = {
    Name        = "${local.name_prefix}-vpce-ecr-api"
    Environment = var.environment
    Project     = var.project
  }
}

resource "aws_vpc_endpoint" "ecr_dkr" {
  vpc_id              = aws_vpc.main.id
  service_name        = "com.amazonaws.${var.aws_region}.ecr.dkr"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.vpc_endpoints.id]
  private_dns_enabled = true

  tags = {
    Name        = "${local.name_prefix}-vpce-ecr-dkr"
    Environment = var.environment
    Project     = var.project
  }
}

# ── Security Groups ────────────────────────────

resource "aws_security_group" "vpc_endpoints" {
  name        = "${local.name_prefix}-vpce-sg"
  description = "Security group for VPC Interface Endpoints"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  tags = {
    Name        = "${local.name_prefix}-vpce-sg"
    Environment = var.environment
    Project     = var.project
  }
}
