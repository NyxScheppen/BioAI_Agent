
# 差异表达分析示例代码
library(limma)
library(ggplot2)
library(pheatmap)

# 1. 读取表达矩阵
# expression_data <- read.csv("expression_matrix.csv", row.names = 1)

# 2. 读取样本分组
# sample_info <- read.csv("sample_groups.csv")

# 3. 创建设计矩阵
# design <- model.matrix(~0 + factor(sample_info$group))
# colnames(design) <- levels(factor(sample_info$group))

# 4. 拟合线性模型
# fit <- lmFit(expression_data, design)

# 5. 创建对比矩阵
# contrast.matrix <- makeContrasts(Tumor_vs_Normal = Tumor - Normal, levels = design)

# 6. 计算差异表达
# fit2 <- contrasts.fit(fit, contrast.matrix)
# fit2 <- eBayes(fit2)

# 7. 提取结果
# deg_results <- topTable(fit2, coef = "Tumor_vs_Normal", number = Inf)

# 8. 保存结果
# write.csv(deg_results, "DEG_results.csv")

