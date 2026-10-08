<script setup>
/**
 * 登录页面组件
 * 功能：实现用户登录表单的展示、验证和提交
 */

// 组件命名
defineOptions({
  name: 'LoginPage'
})

import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/userStore'

// 初始化用户状态管理
const userStore = useUserStore()
const router = useRouter()
const route = useRoute()

/** 登录成功后的跳转路径（仅允许站内相对路径，防止开放重定向） */
function getLoginRedirectPath() {
  const raw = route.query.redirect
  const s = Array.isArray(raw) ? raw[0] : raw
  if (typeof s === 'string' && s.startsWith('/') && !s.startsWith('//')) {
    return s
  }
  return '/'
}

// 登录表单数据
const form = ref({
  account: '',    // 默认账号
  password: '',        // 默认密码
  agree: false               // 是否同意协议
})

/**
 * 表单验证规则
 * 1. 账号验证：必填
 * 2. 密码验证：必填 + 长度限制
 * 3. 协议勾选：自定义验证
 */
const rules = {
  account: [
    { required: true, message: '用户名不能为空', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '密码不能为空', trigger: 'blur' },
    { min: 6, max: 14, message: '密码长度为6-14个字符', trigger: 'blur' },
  ],
  agree: [
    {
      validator: (rule, value, callback) => {
        if (value) {
          callback()
        } else {
          callback(new Error('请勾选协议'))
        }
      }
    }
  ]
}

// 表单实例引用
const formRef = ref(null)

/** 提交中，防止重复点击 */
const submitting = ref(false)

/**
 * 登录处理：校验表单 → 调登录接口 → 成功后跳转（失败由 http 拦截器提示 + catch 拦截跳转）
 */
async function doLogin() {
  if (!formRef.value || submitting.value) return
  try {
    await formRef.value.validate()
  } catch {
    return
  }

  const account = form.value.account.trim()
  const password = form.value.password
  if (!account) {
    ElMessage.warning('请输入账户')
    return
  }

  submitting.value = true
  try {
    await userStore.getUserInfo({ account, password })
    ElMessage.success('登录成功')
    router.replace(getLoginRedirectPath())
  } catch (err) {
    // axios 错误已由拦截器提示；此处补充非请求类错误（如返回数据异常）
    if (!err?.response && err?.message) {
      ElMessage.error(err.message)
    }
  } finally {
    submitting.value = false
  }
}

function onPasswordEnter(e) {
  if (!e.shiftKey) {
    e.preventDefault()
    doLogin()
  }
}
</script>


<template>
  <div>
    <!-- 页面头部 -->
    <header class="login-header">
      <div class="container m-top-20">
        <h1 class="logo">
          <RouterLink to="/">YLDQ</RouterLink>
        </h1>
        <RouterLink class="entry" to="/">
          <i class="iconfont icon-angle-right"></i>
          <i class="iconfont icon-angle-right"></i>
        </RouterLink>
      </div>
    </header>

    <!-- 登录区域 -->
    <section class="login-section">
      <div class="wrapper">
        <!-- 登录导航 -->
        <nav>
          <a href="javascript:;">账户登录</a>
        </nav>
        <!-- 登录表单 -->
        <div class="account-box">
          <div class="form">
            <el-form ref="formRef" :model="form" :rules="rules" label-position="right" label-width="60px" status-icon>
              <!-- 账户输入 -->
              <el-form-item prop="account" label="账户">
                <el-input
                  v-model="form.account"
                  clearable
                  maxlength="32"
                  autocomplete="username"
                  placeholder="请输入账户"
                  @keyup.enter="doLogin"
                />
              </el-form-item>
              <!-- 密码输入 -->
              <el-form-item prop="password" label="密码">
                <el-input
                  v-model="form.password"
                  type="password"
                  show-password
                  maxlength="32"
                  autocomplete="current-password"
                  placeholder="请输入密码"
                  @keydown.enter="onPasswordEnter"
                />
              </el-form-item>
              <!-- 协议勾选 -->
              <el-form-item prop="agree" label-width="22px">
                <el-checkbox size="large" v-model="form.agree">
                  我已同意隐私条款和服务条款
                </el-checkbox>
              </el-form-item>
              <!-- 登录按钮 -->
              <el-button
                size="large"
                class="subBtn"
                type="primary"
                native-type="button"
                :loading="submitting"
                :disabled="submitting"
                @click="doLogin"
              >
                {{ submitting ? '登录中…' : '登录' }}
              </el-button>
            </el-form>
          </div>
        </div>
      </div>
    </section>

    <!-- 页面底部 -->
    <footer class="login-footer">
      <div class="container">
        <p>YLDQ</p>
      </div>
    </footer>
  </div>
</template>

<style scoped lang='scss'>
/* 登录页头部 */
.login-header {
  background: #fff;
  border-bottom: 1px solid #e4e4e4;

  .container {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
  }

  .logo {
    width: 200px;

    a {
      display: block;
      height: 132px;
      width: 100%;
      text-indent: -9999px;
      //background: url("@/assets/images/logo.png") no-repeat center 18px / contain;
    }
  }

  .sub {
    flex: 1;
    font-size: 24px;
    font-weight: normal;
    margin-bottom: 38px;
    margin-left: 20px;
    color: #666;
  }

  .entry {
    width: 120px;
    margin-bottom: 38px;
    font-size: 16px;

    i {
      font-size: 14px;
      color: $xtxColor;
      letter-spacing: -5px;
    }
  }
}

/* 登录区域 */
.login-section {
  background: url('@/assets/images/login-bg.png') no-repeat center / cover;
  height: 488px;
  position: relative;

  .wrapper {
    width: 380px;
    background: #fff;
    position: absolute;
    left: 50%;
    top: 54px;
    transform: translate3d(100px, 0, 0);
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.15);

    nav {
      font-size: 14px;
      height: 55px;
      margin-bottom: 20px;
      border-bottom: 1px solid #f5f5f5;
      display: flex;
      padding: 0 40px;
      text-align: right;
      align-items: center;

      a {
        flex: 1;
        line-height: 1;
        display: inline-block;
        font-size: 18px;
        position: relative;
        text-align: center;
      }
    }
  }
}

/* 页面底部 */
.login-footer {
  padding: 30px 0 50px;
  background: #fff;

  p {
    text-align: center;
    color: #999;
    padding-top: 20px;

    a {
      line-height: 1;
      padding: 0 10px;
      color: #999;
      display: inline-block;

      ~a {
        border-left: 1px solid #ccc;
      }
    }
  }
}

/* 表单样式 */
.account-box {
  .toggle {
    padding: 15px 40px;
    text-align: right;

    a {
      color: $xtxColor;

      i {
        font-size: 14px;
      }
    }
  }

  .form {
    padding: 0 20px 20px 20px;

    &-item {
      margin-bottom: 28px;

      .input {
        position: relative;
        height: 36px;

        >i {
          width: 34px;
          height: 34px;
          background: #cfcdcd;
          color: #fff;
          position: absolute;
          left: 1px;
          top: 1px;
          text-align: center;
          line-height: 34px;
          font-size: 18px;
        }

        input {
          padding-left: 44px;
          border: 1px solid #cfcdcd;
          height: 36px;
          line-height: 36px;
          width: 100%;

          &.error {
            border-color: $priceColor;
          }

          &.active,
          &:focus {
            border-color: $xtxColor;
          }
        }

        .code {
          position: absolute;
          right: 1px;
          top: 1px;
          text-align: center;
          line-height: 34px;
          font-size: 14px;
          background: #f5f5f5;
          color: #666;
          width: 90px;
          height: 34px;
          cursor: pointer;
        }
      }

      >.error {
        position: absolute;
        font-size: 12px;
        line-height: 28px;
        color: $priceColor;

        i {
          font-size: 14px;
          margin-right: 2px;
        }
      }
    }
  }
}

/* 登录按钮 */
.subBtn {
  background: $xtxColor;
  width: 100%;
  color: #fff;
}
</style>