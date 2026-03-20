# init_r_env.R
options(repos = c(CRAN = "https://mirrors.tuna.tsinghua.edu.cn/CRAN/"))
options(BioC_mirror = "https://mirrors.tuna.tsinghua.edu.cn/bioconductor")

# 定义必备全家桶
pkgs <- c("ggplot2", "pheatmap", "reshape2", "dplyr", "tidyr")
bioc_pkgs <- c("limma", "GEOquery", "edgeR", "DESeq2", "clusterProfiler")

# 安装基础包
for (pkg in pkgs) {
    if (!requireNamespace(pkg, quietly = TRUE)) install.packages(pkg)
}

# 安装生信包
if (!requireNamespace("BiocManager", quietly = TRUE)) install.packages("BiocManager")
for (pkg in bioc_pkgs) {
    if (!requireNamespace(pkg, quietly = TRUE)) BiocManager::install(pkg, update = FALSE)
}

cat("\n✅ 所有生信必备包已安装完毕！\n")