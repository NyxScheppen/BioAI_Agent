options(warn = -1)
suppressMessages(library(dplyr, quietly = TRUE))
setwd("/mnt/d/desktop/iGEM_BioAI_Agent/backend/data")
# 设置CRAN镜像
options(repos = c(CRAN = "https://cloud.r-project.org"))

# 安装必要的包
if (!requireNamespace("BiocManager", quietly = TRUE))
    install.packages("BiocManager")

# 安装GEOquery包
if (!requireNamespace("GEOquery", quietly = TRUE))
    BiocManager::install("GEOquery")

# 安装其他必要的包
required_packages <- c("limma", "ggplot2", "pheatmap", "reshape2")
for (pkg in required_packages) {
    if (!requireNamespace(pkg, quietly = TRUE)) {
        install.packages(pkg)
    }
}

# 加载包
library(GEOquery)
library(limma)
library(ggplot2)
library(pheatmap)
library(reshape2)

cat("所有必要的包已加载成功！\n")