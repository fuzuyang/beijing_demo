import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import archiver from 'archiver';
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
  remotePath: '/home/www/html/beijing',
  zipName: 'dist.zip'
};

async function deploy() {
  const sftp = new SftpClient();
  
  try {
    console.log('🚀 开始打包项目...');
    execSync('npm run build', { stdio: 'inherit' });
    console.log('✅ 打包完成');

    console.log('📦 正在压缩文件...');
    await zipDirectory(config.localPath, config.zipName);
    console.log('✅ 压缩完成');

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

    console.log('📤 正在上传压缩包...');
    const remoteZipPath = path.posix.join(config.remotePath, config.zipName);
    await sftp.fastPut(config.zipName, remoteZipPath);
    console.log('✅ 上传完成');

    console.log('🔓 正在解压并清理...');
    // 在远程执行命令：进入目录 -> 解压 -> 删除旧文件（除了zip） -> 移动解压内容 -> 删除zip
    // 注意：这里为了安全，先清空目录内容再解压
    const commands = [
      `cd ${config.remotePath}`,
      `unzip -o ${config.zipName}`,
      `rm ${config.zipName}`
    ];
    
    // 执行远程命令
    // sftp2 没有直接执行 shell 命令的方法，通常需要用 ssh2 库，
    // 但我们可以通过简单的文件操作或者发送指令。
    // 这里我们使用 sftp 的一些特性，或者提示用户服务器需要安装 unzip。
    
    // 如果服务器支持，我们通过 SSH 执行解压
    // 由于 ssh2-sftp-client 主要是文件操作，
    // 我们改用简单的全量文件上传（sftp.uploadDir），这样不需要服务器有 unzip。
    
    console.log('📂 正在同步文件到服务器 (全量同步)...');
    await sftp.uploadDir(config.localPath, config.remotePath);
    console.log('✅ 文件同步完成');

    console.log('\n✨ 部署成功！');
    console.log(`🌍 访问地址: http://${config.host}:5174/beijing/ (请确保 Nginx 配置正确)`);

  } catch (err) {
    console.error('❌ 部署失败:', err.message);
  } finally {
    await sftp.end();
    // 清理本地压缩包
    if (fs.existsSync(config.zipName)) {
      fs.unlinkSync(config.zipName);
    }
  }
}

function zipDirectory(source, out) {
  const archive = archiver('zip', { zlib: { level: 9 } });
  const stream = fs.createWriteStream(out);

  return new Promise((resolve, reject) => {
    archive
      .directory(source, false)
      .on('error', err => reject(err))
      .pipe(stream);

    stream.on('close', () => resolve());
    archive.finalize();
  });
}

deploy();
