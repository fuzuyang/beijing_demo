import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import SftpClient from 'ssh2-sftp-client';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 部署配置
const config = {
  host: '211.149.136.21',
  port: 22000,
  username: 'root',
  password: 'kpx2xp2b',
  localPath: path.resolve(__dirname, 'dist'),
  remotePath: '/home/www/html/beijing'
};

async function deploy() {
  const sftp = new SftpClient();
  
  try {
    console.log('🚀 开始打包项目...');
    execSync('npm run build', { stdio: 'inherit' });
    console.log('✅ 打包完成');

    if (!fs.existsSync(config.localPath)) {
      throw new Error(`本地构建目录不存在: ${config.localPath}`);
    }

    console.log(`连接服务器 ${config.host}:${config.port}...`);
    await sftp.connect({
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password
    });
    console.log('✅ 服务器连接成功');

    // 确保远程目录存在
    const exists = await sftp.exists(config.remotePath);
    if (!exists) {
      console.log(`📁 远程目录不存在，正在创建: ${config.remotePath}`);
      await sftp.mkdir(config.remotePath, true);
    }

    console.log('🧹 正在清空远程目录内容...');
    await emptyRemoteDir(sftp, config.remotePath);
    console.log('✅ 远程目录已清空');

    console.log('📂 正在同步文件到服务器 (全量同步)...');
    await sftp.uploadDir(config.localPath, config.remotePath);
    console.log('✅ 文件同步完成');

    console.log('\n✨ 部署成功！');
    console.log(`🌍 访问地址: http://${config.host}:5174/beijing/ (请确保 Nginx 配置正确)`);

  } catch (err) {
    console.error('❌ 部署失败:', err.message);
  } finally {
    await sftp.end();
  }
}

async function emptyRemoteDir(sftp, remoteDir) {
  if (!remoteDir || remoteDir === '/' || !remoteDir.startsWith('/')) {
    throw new Error(`remotePath 不安全，拒绝清空: ${remoteDir}`);
  }

  const items = await sftp.list(remoteDir);
  for (const item of items) {
    const remoteItemPath = path.posix.join(remoteDir, item.name);
    if (item.type === 'd') {
      await sftp.rmdir(remoteItemPath, true);
      continue;
    }
    await sftp.delete(remoteItemPath);
  }
}

deploy();
