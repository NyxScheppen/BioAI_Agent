# 查看当前目录下的文件
files <- list.files()
print("当前目录下的文件：")
print(files)

# 查找CSV文件
csv_files <- files[grep("\\.csv$", files, ignore.case = TRUE)]
print("\n找到的CSV文件：")
print(csv_files)