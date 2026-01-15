#!/usr/bin/env node

/**
 * Clerk 会话清除脚本
 *
 * 此脚本用于清除 Clerk 相关的登录信息
 * 主要用于开发和测试环境
 */

const fs = require('fs');
const path = require('path');

console.log('🧹 开始清除 Clerk 登录信息...\n');

// 清除可能的 Clerk 配置文件
function clearClerkConfigs() {
    const possiblePaths = [
        path.join(process.cwd(), '.clerk'),
        path.join(process.cwd(), 'node_modules', '.cache', 'clerk'),
        path.join(require('os').homedir(), '.clerk')
    ];

    console.log('📁 清除 Clerk 配置文件...');
    possiblePaths.forEach(configPath => {
        try {
            if (fs.existsSync(configPath)) {
                if (fs.statSync(configPath).isDirectory()) {
                    fs.rmSync(configPath, { recursive: true, force: true });
                    console.log(`  ✅ 删除了目录: ${configPath}`);
                } else {
                    fs.unlinkSync(configPath);
                    console.log(`  ✅ 删除了文件: ${configPath}`);
                }
            }
        } catch (error) {
            console.log(`  ⚠️  无法删除 ${configPath}: ${error.message}`);
        }
    });
}

// 清除环境变量中的 Clerk 令牌（如果存在）
function clearEnvTokens() {
    console.log('\n🔑 清除环境变量中的 Clerk 令牌...');

    const envFiles = ['.env', '.env.local', '.env.development', '.env.test'];

    envFiles.forEach(envFile => {
        const envPath = path.join(process.cwd(), envFile);
        try {
            if (fs.existsSync(envPath)) {
                let content = fs.readFileSync(envPath, 'utf8');
                const originalContent = content;

                // 移除 Clerk 相关的环境变量
                const clerkVars = [
                    /^CLERK_SECRET_KEY=.*/gm,
                    /^NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=.*/gm,
                    /^CLERK_SIGNING_SECRET=.*/gm,
                    /^CLERK_API_KEY=.*/gm,
                    /^CLERK_FRONTEND_API=.*/gm
                ];

                clerkVars.forEach(regex => {
                    content = content.replace(regex, '');
                });

                // 清理多余的空行
                content = content.replace(/\n\s*\n/g, '\n').trim();

                if (content !== originalContent) {
                    fs.writeFileSync(envPath, content);
                    console.log(`  ✅ 更新了 ${envFile}，移除了 Clerk 环境变量`);
                } else {
                    console.log(`  ℹ️  ${envFile} 中没有找到 Clerk 环境变量`);
                }
            }
        } catch (error) {
            console.log(`  ⚠️  无法处理 ${envFile}: ${error.message}`);
        }
    });
}

// 显示使用说明
function showUsage() {
    console.log('\n📋 使用说明:');
    console.log('1. 此脚本已清除本地的 Clerk 配置文件');
    console.log('2. 要完全清除浏览器中的登录状态，请：');
    console.log('   - 打开浏览器开发者工具 (F12)');
    console.log('   - 转到 Application/Storage 标签');
    console.log('   - 清除 Cookies 和 Local Storage 中包含 "clerk" 的项');
    console.log('   - 或使用项目中的 clear-clerk-session.html 文件');
    console.log('\n3. 重新启动开发服务器：npm run dev');
}

// 主函数
function main() {
    console.log('🚀 Clerk 会话清除工具\n');

    try {
        clearClerkConfigs();
        clearEnvTokens();

        console.log('\n✅ Clerk 登录信息清除完成！');
        showUsage();

    } catch (error) {
        console.error('\n❌ 清除过程中出现错误:', error.message);
        process.exit(1);
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    main();
}

module.exports = { clearClerkConfigs, clearEnvTokens };
