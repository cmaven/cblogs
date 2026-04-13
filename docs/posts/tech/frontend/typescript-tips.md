---
title: "TypeScript 실전 타입 활용 팁"
date: 2026-04-12
category: tech
subcategory: frontend
excerpt: "TypeScript의 유틸리티 타입, 제네릭, 타입 가드 등 실전에서 유용한 패턴을 정리합니다."
tags: [typescript, javascript, tips]
---

# TypeScript 실전 타입 활용 팁

## 유틸리티 타입 활용

TypeScript는 자주 사용되는 타입 변환을 위한 유틸리티 타입을 제공합니다.

### Partial과 Required

```typescript
interface User {
  id: number
  name: string
  email: string
}

// 모든 필드를 선택적으로
type UpdateUser = Partial<User>

// 모든 필드를 필수로
type StrictUser = Required<User>
```

### Pick과 Omit

```typescript
// 특정 필드만 선택
type UserPreview = Pick<User, 'id' | 'name'>

// 특정 필드 제외
type UserWithoutEmail = Omit<User, 'email'>
```

## 제네릭 패턴

```typescript
// API 응답 래퍼
interface ApiResponse<T> {
  data: T
  status: number
  message: string
}

// 사용
const response: ApiResponse<User[]> = await fetchUsers()
```

## 타입 가드

```typescript
function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function processValue(value: unknown) {
  if (isString(value)) {
    // 여기서 value는 string 타입
    console.log(value.toUpperCase())
  }
}
```

## Discriminated Union

```typescript
type Shape =
  | { kind: 'circle'; radius: number }
  | { kind: 'rectangle'; width: number; height: number }

function area(shape: Shape): number {
  switch (shape.kind) {
    case 'circle':
      return Math.PI * shape.radius ** 2
    case 'rectangle':
      return shape.width * shape.height
  }
}
```

타입을 잘 활용하면 런타임 에러를 컴파일 타임에 잡을 수 있습니다.
