# 1. 强制使用清华镜像源，防止 Agent 抽风自动安装包时失败
options(repos = c(CRAN = "https://mirrors.tuna.tsinghua.edu.cn/CRAN/"))
options(BioC_mirror = "https://mirrors.tuna.tsinghua.edu.cn/bioconductor")
# 2. 环境诊断：把 R 找包的路径打印出来，方便Debug
cat("Current LibPaths: ", .libPaths(), "\n")
# 3. 路径适配：设置工作目录
setwd("/mnt/d/desktop/iGEM_BioAI_Agent/backend/data")
# 4. 抑制不必要的警告，让 Agent 输出更干净
options(warn = -1)
suppressMessages(library(methods))
# 5. 自动容错逻辑：如果包不存在，尝试加载（但不阻塞）
safe_load <- function(pkg) { if(!require(pkg, character.only=TRUE, quietly=TRUE)) { cat(paste0("MISSING_PKG: ", pkg, "\n")) } }
# 使用基础方法读取GEO数据
cat("正在读取GEO数据文件...\n")

# 读取文件内容
con <- gzfile("GSE84402_series_matrix.txt.gz", "r")
lines <- readLines(con)
close(con)

# 查找数据开始位置
data_start <- grep("^!series_matrix_table_begin", lines)
data_end <- grep("^!series_matrix_table_end", lines)

cat("数据开始行:", data_start, "\n")
cat("数据结束行:", data_end, "\n")

# 提取数据部分
data_lines <- lines[(data_start + 1):(data_end - 1)]

# 解析数据
cat("\n正在解析数据...\n")
# 第一行是列名（样本ID）
col_names <- unlist(strsplit(data_lines[1], "\t"))
cat("样本数量:", length(col_names) - 1, "\n")  # 减去第一列的基因ID

# 提取基因表达数据
expr_data <- data.frame()
gene_ids <- c()

for (i in 2:length(data_lines)) {
  if (i %% 1000 == 0) cat("处理第", i, "行...\n")
  parts <- unlist(strsplit(data_lines[i], "\t"))
  gene_ids <- c(gene_ids, parts[1])
  expr_data <- rbind(expr_data, as.numeric(parts[-1]))
}

# 设置行名和列名
rownames(expr_data) <- gene_ids
colnames(expr_data) <- col_names[-1]

cat("\n=== 数据基本信息 ===\n")
cat("表达矩阵维度:", dim(expr_data), "\n")
cat("基因数量:", nrow(expr_data), "\n")
cat("样本数量:", ncol(expr_data), "\n")

# 查看前几个基因和样本
cat("\n前5个基因ID:\n")
print(head(gene_ids, 5))
cat("\n前5个样本ID:\n")
print(head(col_names[-1], 5))
cat("\n表达矩阵前3行3列:\n")
print(expr_data[1:3, 1:3])

# 提取注释信息
cat("\n=== 提取注释信息 ===\n")
# 查找样本注释信息
sample_info_start <- grep("^!Sample_", lines)
sample_info_lines <- lines[sample_info_start]

# 解析样本信息
sample_info <- list()
for (line in sample_info_lines) {
  if (grepl("^!Sample_", line)) {
    parts <- unlist(strsplit(line, "\t"))
    key <- gsub("^!Sample_", "", parts[1])
    values <- parts[-1]
    sample_info[[key]] <- values
  }
}

cat("找到的样本信息字段数量:", length(sample_info), "\n")
cat("样本信息字段:\n")
print(names(sample_info))

# 特别查看tissue信息
if ("characteristics_ch1" %in% names(sample_info)) {
  cat("\n=== 样本特征信息 ===\n")
  tissue_info <- sample_info[["characteristics_ch1"]]
  cat("前5个样本的特征信息:\n")
  for (i in 1:min(5, length(tissue_info))) {
    cat("样本", i, ":", tissue_info[i], "\n")
  }
}

# 数据质量检查
cat("\n=== 数据质量检查 ===\n")
cat("表达矩阵NA值数量:", sum(is.na(expr_data)), "\n")
cat("表达矩阵最小值:", min(expr_data, na.rm = TRUE), "\n")
cat("表达矩阵最大值:", max(expr_data, na.rm = TRUE), "\n")
cat("表达矩阵中位数:", median(expr_data, na.rm = TRUE), "\n")
cat("表达矩阵平均值:", mean(as.matrix(expr_data), na.rm = TRUE), "\n")

# 绘制样本表达分布箱线图
cat("\n正在绘制样本表达分布图...\n")
png("sample_expression_boxplot.png", width = 1200, height = 800, res = 150)
par(mar = c(8, 4, 4, 2))
boxplot(expr_data, las = 2, main = "样本表达值分布", 
        ylab = "表达值", col = "lightblue")
dev.off()
cat("样本表达分布图已保存为: sample_expression_boxplot.png\n")

# 计算并绘制样本相关性热图
cat("\n正在计算样本相关性...\n")
# 由于数据可能很大，先取子集进行计算
if (ncol(expr_data) > 50) {
  cat("样本数量较多，使用前50个样本进行相关性分析...\n")
  expr_subset <- expr_data[, 1:min(50, ncol(expr_data))]
} else {
  expr_subset <- expr_data
}

sample_cor <- cor(expr_subset, use = "complete.obs")
png("sample_correlation_heatmap.png", width = 1000, height = 800, res = 150)
par(mar = c(5, 4, 4, 2))
image(sample_cor, 
      main = "样本间相关性热图",
      col = colorRampPalette(c("blue", "white", "red"))(100),
      xaxt = "n", yaxt = "n")
axis(1, at = seq(0, 1, length.out = ncol(sample_cor)), 
     labels = colnames(sample_cor), las = 2, cex.axis = 0.6)
axis(2, at = seq(0, 1, length.out = ncol(sample_cor)), 
     labels = colnames(sample_cor), las = 1, cex.axis = 0.6)
dev.off()
cat("样本相关性热图已保存为: sample_correlation_heatmap.png\n")

# 保存处理后的数据
saveRDS(expr_data, file = "GSE84402_expression_matrix.rds")

# 保存样本信息
if (length(sample_info) > 0) {
  saveRDS(sample_info, file = "GSE84402_sample_info.rds")
}

cat("\n=== 数据处理完成 ===\n")
cat("1. 表达矩阵已保存为: GSE84402_expression_matrix.rds\n")
cat("2. 样本信息已保存为: GSE84402_sample_info.rds\n")
cat("3. 可视化结果已保存为PNG文件\n")
cat("\n数据维度:", dim(expr_data), "\n")
cat("基因数量:", nrow(expr_data), "\n")
cat("样本数量:", ncol(expr_data), "\n")