import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

interface FileEntry {
  file: {
    contents: string
  }
}

interface DirectoryEntry {
  directory: {
    [key: string]: FileEntry | DirectoryEntry
  }
}

type FileSystemTree = {
  [key: string]: FileEntry | DirectoryEntry
}
const ignoreFilesOrDirs = ['pnpm-lock.yaml', 'node_modules', '.git', 'scripts', 'files.ts']

function readDirectory(dirPath: string): FileSystemTree {
  const result: FileSystemTree = {}
  const items = readdirSync(dirPath)

  for (const item of items) {
    const fullPath = join(dirPath, item)
    const stat = statSync(fullPath)

    // 跳过 node_modules 和 .git 目录
    if (ignoreFilesOrDirs.includes(item)) {
      continue
    }

    if (stat.isDirectory()) {
      result[item] = {
        directory: readDirectory(fullPath)
      }
    } else {
      // 读取文件内容
      const contents = readFileSync(fullPath, 'utf-8')
      result[item] = {
        file: {
          contents
        }
      }
    }
  }

  return result
}

function generateFiles() {
  const projectRoot = process.cwd()
  const fileSystem = readDirectory(projectRoot)

  const output = `/** @satisfies {import('@webcontainer/api').FileSystemTree} */
export const files = ${JSON.stringify(fileSystem, null, 2)}`

  writeFileSync(join(projectRoot, 'src/files.ts'), output)
}

generateFiles()