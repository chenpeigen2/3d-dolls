/**
 * 静态站点部署脚本。
 *
 * 凭据只从环境变量读取，不写入仓库：
 *   DEPLOY_HOST=... DEPLOY_USER=root DEPLOY_PASSWORD=... node scripts/deploy.mjs --inspect
 *   DEPLOY_HOST=... DEPLOY_USER=root DEPLOY_PASSWORD=... node scripts/deploy.mjs
 *
 * 也可以使用 DEPLOY_PRIVATE_KEY 指定私钥路径。
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { Client } from 'ssh2';

const host = process.env.DEPLOY_HOST;
const username = process.env.DEPLOY_USER ?? 'root';
const password = process.env.DEPLOY_PASSWORD;
const privateKeyPath = process.env.DEPLOY_PRIVATE_KEY;
const inspectOnly = process.argv.includes('--inspect');

if (!host || (!password && !privateKeyPath)) {
  console.error('需要 DEPLOY_HOST，以及 DEPLOY_PASSWORD 或 DEPLOY_PRIVATE_KEY。');
  process.exit(1);
}

const distDir = resolve('dist');
if (!inspectOnly && !existsSync(join(distDir, 'index.html'))) {
  console.error('dist/index.html 不存在，请先运行 npm run build。');
  process.exit(1);
}

const connection = new Client();
const release = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '');
const remoteBase = '/opt/frog-3d-web';

function exec(command, { allowFailure = false } = {}) {
  return new Promise((resolvePromise, reject) => {
    connection.exec(command, (error, stream) => {
      if (error) {
        reject(error);
        return;
      }
      let stdout = '';
      let stderr = '';
      stream.on('data', (chunk) => {
        stdout += chunk.toString();
        process.stdout.write(chunk);
      });
      stream.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
        process.stderr.write(chunk);
      });
      stream.on('close', (code) => {
        if (code !== 0 && !allowFailure) {
          reject(new Error(`远端命令失败（${code}）：${stderr || stdout}`));
        } else {
          resolvePromise({ code, stdout, stderr });
        }
      });
    });
  });
}

function upload(local, remote) {
  return new Promise((resolvePromise, reject) => {
    connection.sftp((error, sftp) => {
      if (error) {
        reject(error);
        return;
      }
      sftp.fastPut(local, remote, (uploadError) => {
        sftp.end();
        if (uploadError) reject(uploadError);
        else resolvePromise();
      });
    });
  });
}

const inspectCommand = String.raw`
set +e
echo '--- system ---'
uname -srmo
[ -f /etc/os-release ] && grep -E '^(PRETTY_NAME|ID|VERSION_ID)=' /etc/os-release
echo '--- runtimes ---'
command -v python3 && python3 --version
command -v node && node --version
command -v systemctl
echo '--- port 4173 ---'
if command -v ss >/dev/null; then ss -ltnp | grep ':4173 ' || true; else netstat -ltnp 2>/dev/null | grep ':4173 ' || true; fi
echo '--- existing service ---'
systemctl is-active frog-3d-web.service 2>/dev/null || true
echo '--- disk ---'
df -h /opt 2>/dev/null || df -h /
`;

async function main() {
  console.log(`连接 ${host}，先检查远端环境…`);
  await exec(inspectCommand);

  if (inspectOnly) return;

  const portCheck = await exec(
    "(ss -ltnp 2>/dev/null || netstat -ltnp 2>/dev/null) | grep ':4173 ' || true",
  );
  const serviceCheck = await exec('systemctl is-active frog-3d-web.service 2>/dev/null || true');
  if (portCheck.stdout.trim() && serviceCheck.stdout.trim() !== 'active') {
    throw new Error('4173 已被其他进程占用，部署已停止；请先确认该进程是否可以替换。');
  }

  const tempDir = mkdtempSync(join(tmpdir(), 'frog-3d-web-'));
  const archive = join(tempDir, 'dist.tar.gz');
  execFileSync('tar', ['-czf', basename(archive), '-C', distDir, '.'], {
    cwd: tempDir,
    stdio: 'inherit',
  });

  const remoteArchive = `/tmp/frog-3d-web-${release}.tar.gz`;
  const releaseDir = `${remoteBase}/releases/${release}`;
  console.log(`上传 ${basename(archive)} 到 ${host}:${remoteArchive}…`);
  await upload(archive, remoteArchive);

  console.log('解压新版本并切换 current 软链接…');
  await exec(`set -e
mkdir -p '${releaseDir}'
tar -xzf '${remoteArchive}' -C '${releaseDir}'
ln -sfn '${releaseDir}' '${remoteBase}/current'
rm -f '${remoteArchive}'
test -f '${remoteBase}/current/index.html'
`);

  console.log('配置并重启静态服务…');
  await exec(`set -e
PYTHON=$(command -v python3)
if [ -z "$PYTHON" ]; then echo '服务器缺少 python3' >&2; exit 1; fi
id -u frogweb >/dev/null 2>&1 || useradd --system --no-create-home frogweb
cat > /etc/systemd/system/frog-3d-web.service <<EOF
[Unit]
Description=Frog 3D static website
After=network.target

[Service]
Type=simple
User=frogweb
Group=frogweb
WorkingDirectory=${remoteBase}/current
ExecStart=$PYTHON -m http.server 4173 --bind 0.0.0.0 --directory ${remoteBase}/current
Restart=always
RestartSec=3
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable frog-3d-web.service
systemctl restart frog-3d-web.service
systemctl is-active frog-3d-web.service
`);

  // 仅在对应防火墙已经运行时添加规则；云安全组仍需在云平台另行确认。
  await exec(`set +e
if command -v firewall-cmd >/dev/null && firewall-cmd --state 2>/dev/null | grep -q running; then
  firewall-cmd --permanent --add-port=4173/tcp >/dev/null
  firewall-cmd --reload >/dev/null
fi
if command -v ufw >/dev/null && ufw status 2>/dev/null | grep -q 'Status: active'; then
  ufw allow 4173/tcp >/dev/null
fi
`);

  console.log('远端健康检查…');
  await exec(`set -e
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS http://127.0.0.1:4173/ | grep -q '布艺青蛙'; then
    echo 'HTTP health check passed'
    exit 0
  fi
  sleep 1
done
echo '页面未通过健康检查' >&2
systemctl status frog-3d-web.service --no-pager -l
exit 1
`);

  rmSync(tempDir, { recursive: true, force: true });
  console.log(`部署完成：http://${host}:4173/`);
}

connection.on('ready', () => {
  main()
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    })
    .finally(() => connection.end());
});

connection.on('error', (error) => {
  console.error(`SSH 连接失败：${error.message}`);
  process.exitCode = 1;
});

const credentials = {
  host,
  port: 22,
  username,
  readyTimeout: 20_000,
};
if (privateKeyPath) {
  credentials.privateKey = readFileSync(privateKeyPath);
} else {
  credentials.password = password;
}
connection.connect(credentials);
