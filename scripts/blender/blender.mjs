/**
 * Blender 调用包装器：自动定位本机的 Blender 可执行文件。
 *
 * 用法：node scripts/blender/blender.mjs --background --python scripts/blender/build_frog.py
 *
 * 查找顺序：
 *   1. 环境变量 BLENDER_PATH
 *   2. C:\Program Files\Blender Foundation\*\blender.exe
 *   3. PATH 中的 blender
 */
import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

function locateBlender() {
  const fromEnv = process.env.BLENDER_PATH;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;

  const roots = [
    'C:\\Program Files\\Blender Foundation',
    'C:\\Program Files (x86)\\Blender Foundation',
    '/Applications',
    '/usr/local/bin',
  ];

  for (const root of roots) {
    if (!existsSync(root)) continue;
    try {
      for (const entry of readdirSync(root)) {
        const candidate = join(root, entry, 'blender.exe');
        if (existsSync(candidate)) return candidate;
        const flat = join(root, entry);
        if (existsSync(flat) && !entry.includes('.')) {
          const unix = join(root, entry, 'blender');
          if (existsSync(unix)) return unix;
        }
      }
    } catch {
      // 忽略无法读取的目录
    }
  }

  return null;
}

const executable = locateBlender();

if (!executable) {
  console.error('找不到 Blender 可执行文件。');
  console.error('请安装 Blender，或通过环境变量 BLENDER_PATH 指定路径。');
  process.exit(1);
}

console.log(`使用 Blender：${executable}`);

const child = spawn(executable, process.argv.slice(2), { stdio: 'inherit' });
child.on('exit', (code) => process.exit(code ?? 0));
