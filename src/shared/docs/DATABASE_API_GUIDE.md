# 메이플 재획 대시보드 - DB 및 API 구현 가이드

---

## ID 관계 명확화

**Supabase Auth와 앱 내부 ID의 관계:**
- `auth.users.id`: Supabase Auth가 관리하는 인증용 ID (절대 변경되지 않음)
- `public.users.id`: 앱 내부에서 사용하는 사용자 PK (UUID)
- `public.users.auth_id`: `auth.users.id`와 연결되는 FK
- `records.user_id`: `public.users.id`를 참조 (앱 내부 사용자 ID)

**API에서 사용자 식별 순서:**
1. `auth.uid()`로 현재 로그인한 Supabase Auth ID 획득
2. `SELECT id FROM users WHERE auth_id = auth.uid()`로 앱 내부 사용자 ID 조회
3. 해당 ID로 records/goals/settings 테이블 접근

---

## Part 1. Supabase 스키마 마이그레이션

### 데이터베이스 초기화 SQL

### 실행용 SQL
이 블록만 복사해서 Supabase SQL Editor에 붙여넣으면 된다.

```sql
CREATE TABLE public.characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  character_name VARCHAR(50) NOT NULL,
  character_ocid VARCHAR(255),
  class VARCHAR(50),
  level INT,
  image_url TEXT,
  character_world TEXT,
  character_exp_rate NUMERIC,
  character_combat_power BIGINT,

  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT valid_level CHECK (level >= 1 AND level <= 300)
);

CREATE INDEX idx_characters_user_id ON public.characters(user_id);
CREATE INDEX idx_characters_user_active ON public.characters(user_id, is_active);
CREATE INDEX idx_characters_user_ocid ON public.characters(user_id, character_ocid);

NOTIFY pgrst, 'reload schema';
```

실행 순서:
1. `public.users`가 이미 있으면 그대로 둔다.
2. 위 `public.characters` SQL만 실행한다.
3. `NOTIFY pgrst, 'reload schema';`까지 같이 실행한다.
4. Supabase Table Editor를 새로고침하거나 잠깐 기다린다.

> 참고: 현재 프로젝트는 서버에서 `service role`로 DB를 쓰고 있어서, 이 단계에서는 `characters` 테이블에 RLS 정책을 넣지 않았다.  
> 나중에 클라이언트에서 Supabase를 직접 읽게 되면, 그때 `auth_id` 같은 연결 컬럼을 먼저 추가한 뒤 RLS를 다시 설계하면 된다.

#### 1. Users 테이블
```sql
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 인증 연결
  auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- 로컬 데이터와 연결
  local_owner_id UUID UNIQUE,
  
  -- 프로필 정보
  character_name VARCHAR(50) NOT NULL,
  character_ocid VARCHAR(255),
  class VARCHAR(50),
  level INT,
  image_url TEXT,
  
  -- 메타데이터
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  synced_local_at TIMESTAMP WITH TIME ZONE,
  
  CONSTRAINT valid_level CHECK (level >= 1 AND level <= 300)
);

-- 인덱스
CREATE INDEX idx_users_auth_id ON public.users(auth_id);
CREATE INDEX idx_users_local_owner_id ON public.users(local_owner_id);
CREATE INDEX idx_users_created_at ON public.users(created_at);

-- Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_select_own ON public.users FOR SELECT
  USING (auth.uid() = auth_id);

CREATE POLICY users_update_own ON public.users FOR UPDATE
  USING (auth.uid() = auth_id);

CREATE POLICY users_insert_own ON public.users FOR INSERT
  WITH CHECK (auth.uid() = auth_id);

CREATE POLICY users_delete_own ON public.users FOR DELETE
  USING (auth.uid() = auth_id);
```

#### 1-2. Characters 테이블
```sql
CREATE TABLE public.characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  character_name VARCHAR(50) NOT NULL,
  character_ocid VARCHAR(255),
  class VARCHAR(50),
  level INT,
  image_url TEXT,
  character_world TEXT,
  character_exp_rate NUMERIC,
  character_combat_power BIGINT,

  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT valid_level CHECK (level >= 1 AND level <= 300)
);

CREATE INDEX idx_characters_user_id ON public.characters(user_id);
CREATE INDEX idx_characters_user_active ON public.characters(user_id, is_active);
CREATE INDEX idx_characters_user_ocid ON public.characters(user_id, character_ocid);

ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;

CREATE POLICY characters_select_own ON public.characters FOR SELECT
  USING (user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid()));

CREATE POLICY characters_insert_own ON public.characters FOR INSERT
  WITH CHECK (user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid()));

CREATE POLICY characters_update_own ON public.characters FOR UPDATE
  USING (user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid()));

CREATE POLICY characters_delete_own ON public.characters FOR DELETE
  USING (user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid()));

-- schema cache 갱신용
NOTIFY pgrst, 'reload schema';
```

### 실행 순서
1. `public.users`가 이미 있으면 그대로 둔다.
2. `public.characters`만 위 SQL로 추가한다.
3. 마지막 `NOTIFY pgrst, 'reload schema';`까지 실행한다.
4. Supabase Table Editor를 새로고침하거나 잠깐 기다린다.

### 테이블만 빠르게 추가할 때
아래 SQL만 따로 실행해도 된다.

```sql
CREATE TABLE public.characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  character_name VARCHAR(50) NOT NULL,
  character_ocid VARCHAR(255),
  class VARCHAR(50),
  level INT,
  image_url TEXT,
  character_world TEXT,
  character_exp_rate NUMERIC,
  character_combat_power BIGINT,

  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT valid_level CHECK (level >= 1 AND level <= 300)
);

CREATE INDEX idx_characters_user_id ON public.characters(user_id);
CREATE INDEX idx_characters_user_active ON public.characters(user_id, is_active);
CREATE INDEX idx_characters_user_ocid ON public.characters(user_id, character_ocid);

ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;

CREATE POLICY characters_select_own ON public.characters FOR SELECT
  USING (user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid()));

CREATE POLICY characters_insert_own ON public.characters FOR INSERT
  WITH CHECK (user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid()));

CREATE POLICY characters_update_own ON public.characters FOR UPDATE
  USING (user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid()));

CREATE POLICY characters_delete_own ON public.characters FOR DELETE
  USING (user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid()));

NOTIFY pgrst, 'reload schema';
```

#### 2. Records 테이블
```sql
CREATE TABLE public.records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 소유자 (필수)
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- 기록 데이터
  date DATE NOT NULL,
  time_minutes INT NOT NULL,
  meso BIGINT NOT NULL,
  shard_count INT NOT NULL,
  material_cost BIGINT NOT NULL DEFAULT 0,
  memo TEXT,
  
  -- 마이그레이션 추적
  local_id UUID,  -- 로컬 IndexedDB ID
  
  -- 메타데이터
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT valid_time CHECK (time_minutes > 0),
  CONSTRAINT valid_meso CHECK (meso >= 0),
  CONSTRAINT valid_shards CHECK (shard_count >= 0),
  CONSTRAINT valid_material CHECK (material_cost >= 0)
);

-- 인덱스 (쿼리 성능)
CREATE INDEX idx_records_user_id ON public.records(user_id);
CREATE INDEX idx_records_date ON public.records(date);
CREATE INDEX idx_records_user_date ON public.records(user_id, date);
CREATE INDEX idx_records_user_created ON public.records(user_id, created_at DESC);

-- Row Level Security
ALTER TABLE public.records ENABLE ROW LEVEL SECURITY;

CREATE POLICY records_select_own ON public.records FOR SELECT
  USING (user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid()));

CREATE POLICY records_insert_own ON public.records FOR INSERT
  WITH CHECK (user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid()));

CREATE POLICY records_update_own ON public.records FOR UPDATE
  USING (user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid()));

CREATE POLICY records_delete_own ON public.records FOR DELETE
  USING (user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid()));
```

#### 3. Goals 테이블
```sql
CREATE TABLE public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 소유자
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- 목표 기간
  month VARCHAR(7) NOT NULL,  -- "2026-04"
  
  -- 목표값
  meso_goal BIGINT,
  shard_goal INT,
  time_goal_minutes INT,
  
  -- 메타데이터
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT valid_month CHECK (month ~ '^[0-9]{4}-[0-9]{2}$')
);

-- 유니크 제약 (사용자당 월별 1개)
CREATE UNIQUE INDEX idx_goals_user_month ON public.goals(user_id, month);

-- Row Level Security
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY goals_select_own ON public.goals FOR SELECT
  USING (user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid()));

CREATE POLICY goals_insert_own ON public.goals FOR INSERT
  WITH CHECK (user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid()));

CREATE POLICY goals_update_own ON public.goals FOR UPDATE
  USING (user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid()));

CREATE POLICY goals_delete_own ON public.goals FOR DELETE
  USING (user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid()));
```

#### 4. User Settings 테이블
```sql
CREATE TABLE public.user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 소유자
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- 설정값
  shard_price BIGINT NOT NULL DEFAULT 107653,
  shard_price_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Seoul',
  
  -- 메타데이터
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT valid_shard_price CHECK (shard_price > 0)
);

-- Row Level Security
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY settings_select_own ON public.user_settings FOR SELECT
  USING (user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid()));

CREATE POLICY settings_update_own ON public.user_settings FOR UPDATE
  USING (user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid()));
```

#### 5. Sync Log 테이블 (선택사항, 마이그레이션 추적용)
```sql
CREATE TABLE public.sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  sync_type VARCHAR(50) NOT NULL,  -- "transfer", "merge", etc.
  local_records_count INT,
  server_records_count INT,
  merged_count INT,
  
  status VARCHAR(20) NOT NULL,  -- "pending", "in_progress", "completed", "failed"
  error_message TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_sync_logs_user_id ON public.sync_logs(user_id);
```

---

## Part 2. API 엔드포인트 구현

### app/api/records/route.ts

```typescript
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Record, RecordWithCalculations } from "@/types";
import { enrichRecordWithCalculations } from "@/lib/utils/calculations";

const supabase = createRouteHandlerClient({ cookies });

/**
 * GET /api/records
 * 기록 조회 (필터 지원)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");
    const limit = parseInt(searchParams.get("limit") || "100");

    // 인증된 사용자만
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 사용자 조회
    const { data: userData } = await supabase
      .from("users")
      .select("id")
      .eq("auth_id", user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 기록 조회
    let query = supabase
      .from("records")
      .select("*")
      .eq("user_id", userData.id)
      .order("date", { ascending: false });

    if (startDate) {
      query = query.gte("date", startDate);
    }
    if (endDate) {
      query = query.lte("date", endDate);
    }

    const { data: records, error } = await query.limit(limit);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 시세 조회
    const { data: settings } = await supabase
      .from("user_settings")
      .select("shard_price")
      .eq("user_id", userData.id)
      .single();

    const shardPrice = settings?.shard_price || 107653;

    // 계산 추가
    const enrichedRecords = records.map((r) =>
      enrichRecordWithCalculations(r as Record, shardPrice)
    );

    return NextResponse.json({
      records: enrichedRecords,
      total_count: enrichedRecords.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/records
 * 새 기록 생성
 */
export async function POST(request: NextRequest) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 사용자 조회
    const { data: userData } = await supabase
      .from("users")
      .select("id")
      .eq("auth_id", user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await request.json();

    // 데이터 유효성 검사
    if (
      !body.date ||
      !body.time_minutes ||
      body.meso === undefined ||
      body.shard_count === undefined
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // 기록 저장
    const { data: newRecord, error } = await supabase
      .from("records")
      .insert({
        user_id: userData.id,
        date: body.date,
        time_minutes: body.time_minutes,
        meso: body.meso,
        shard_count: body.shard_count,
        material_cost: body.material_cost || 0,
        memo: body.memo,
        local_id: body.id,  // 로컬 ID 저장
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 설정 조회
    const { data: settings } = await supabase
      .from("user_settings")
      .select("shard_price")
      .eq("user_id", userData.id)
      .single();

    const shardPrice = settings?.shard_price || 107653;

    // 계산 추가
    const enriched = enrichRecordWithCalculations(
      newRecord as Record,
      shardPrice
    );

    return NextResponse.json(enriched, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
```

### app/api/records/[id]/route.ts

```typescript
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const supabase = createRouteHandlerClient({ cookies });

/**
 * PUT /api/records/[id]
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // 현재 기록 확인 (소유권 검증)
    const { data: existingRecord } = await supabase
      .from("records")
      .select("user_id")
      .eq("id", params.id)
      .single();

    if (!existingRecord) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // 사용자 조회
    const { data: userData } = await supabase
      .from("users")
      .select("id")
      .eq("auth_id", user.id)
      .single();

    if (existingRecord.user_id !== userData?.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 업데이트
    const { data: updatedRecord, error } = await supabase
      .from("records")
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(updatedRecord);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/records/[id]
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 현재 기록 확인
    const { data: existingRecord } = await supabase
      .from("records")
      .select("user_id")
      .eq("id", params.id)
      .single();

    if (!existingRecord) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // 사용자 조회
    const { data: userData } = await supabase
      .from("users")
      .select("id")
      .eq("auth_id", user.id)
      .single();

    if (existingRecord.user_id !== userData?.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 삭제
    const { error } = await supabase
      .from("records")
      .delete()
      .eq("id", params.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
```

### app/api/goals/route.ts

```typescript
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const supabase = createRouteHandlerClient({ cookies });

/**
 * GET /api/goals/current
 * 현재 월의 목표 조회
 */
export async function GET(request: NextRequest) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 사용자 조회
    const { data: userData } = await supabase
      .from("users")
      .select("id")
      .eq("auth_id", user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 현재 월
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, "0")}`;

    // 목표 조회
    const { data: goal, error } = await supabase
      .from("goals")
      .select("*")
      .eq("user_id", userData.id)
      .eq("month", currentMonth)
      .single();

    if (error && error.code !== "PGRST116") {  // PGRST116 = not found
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ goal: goal || null });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/goals
 * 목표 생성 또는 업데이트
 */
export async function POST(request: NextRequest) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from("users")
      .select("id")
      .eq("auth_id", user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await request.json();
    const { month, meso_goal, shard_goal, time_goal_minutes } = body;

    if (!month) {
      return NextResponse.json(
        { error: "Month is required" },
        { status: 400 }
      );
    }

    // 기존 목표 확인
    const { data: existingGoal } = await supabase
      .from("goals")
      .select("id")
      .eq("user_id", userData.id)
      .eq("month", month)
      .single();

    if (existingGoal) {
      // 업데이트
      const { data: updated, error } = await supabase
        .from("goals")
        .update({
          meso_goal,
          shard_goal,
          time_goal_minutes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingGoal.id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(updated);
    } else {
      // 생성
      const { data: newGoal, error } = await supabase
        .from("goals")
        .insert({
          user_id: userData.id,
          month,
          meso_goal,
          shard_goal,
          time_goal_minutes,
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(newGoal, { status: 201 });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
```

### app/api/analytics/summary/route.ts

```typescript
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import {
  enrichRecordWithCalculations,
  calculateAverages,
  sumRecords,
  findExtremes,
  calculateTrend,
} from "@/lib/utils/calculations";

const supabase = createRouteHandlerClient({ cookies });

/**
 * GET /api/analytics/summary?period=week|month|all
 */
export async function GET(request: NextRequest) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const period = request.nextUrl.searchParams.get("period") || "month";

    // 사용자 조회
    const { data: userData } = await supabase
      .from("users")
      .select("id")
      .eq("auth_id", user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 기간 계산
    const now = new Date();
    let startDate: string;

    if (period === "week") {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      startDate = weekAgo.toISOString().split("T")[0];
    } else if (period === "month") {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      startDate = monthAgo.toISOString().split("T")[0];
    } else {
      startDate = "2000-01-01";  // 전체
    }

    // 기록 조회
    const { data: records } = await supabase
      .from("records")
      .select("*")
      .eq("user_id", userData.id)
      .gte("date", startDate)
      .order("date", { ascending: false });

    // 시세 조회
    const { data: settings } = await supabase
      .from("user_settings")
      .select("shard_price")
      .eq("user_id", userData.id)
      .single();

    const shardPrice = settings?.shard_price || 107653;

    // 계산
    const enrichedRecords = records!.map((r) =>
      enrichRecordWithCalculations(r as any, shardPrice)
    );

    const sums = sumRecords(enrichedRecords);
    const averages = calculateAverages(enrichedRecords);
    const extremes = findExtremes(enrichedRecords);
    const trend = calculateTrend(enrichedRecords);

    return NextResponse.json({
      period,
      summary: {
        total_revenue: sums.total_revenue,
        total_records: sums.count,
        average_revenue: averages?.average_revenue || 0,
        average_time_minutes: averages?.average_time_minutes || 0,
        total_time_minutes: sums.total_time_minutes,
        max_record: extremes?.max_record.net_revenue || 0,
        min_record: extremes?.min_record.net_revenue || 0,
        trend: trend,
        trend_direction: trend > 0 ? "up" : trend < 0 ? "down" : "stable",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
```

### app/api/auth/callback/route.ts

```typescript
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const supabase = createRouteHandlerClient({ cookies });

/**
 * POST /api/auth/callback
 * 카카오 로그인 콜백
 */
export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json();

    // Kakao 토큰 교환
    const tokenResponse = await fetch(
      "https://kauth.kakao.com/oauth/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: process.env.NEXT_PUBLIC_KAKAO_CLIENT_ID!,
          redirect_uri: process.env.KAKAO_REDIRECT_URI!,
          code,
        }),
      }
    );

    const { access_token } = await tokenResponse.json();

    // Supabase 로그인
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: "kakao",
      token: access_token,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 사용자 정보 저장
    const { data: userProfile } = await supabase
      .from("users")
      .insert({
        auth_id: data.user?.id,
        character_name: data.user?.user_metadata?.name || "Unknown",
      })
      .select()
      .single();

    return NextResponse.json({
      user: data.user,
      token: data.session?.access_token,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
```

---

## Part 3. 마이그레이션 로직

### lib/migrations/localToServer.ts

```typescript
import { Record, Goal } from "@/types";

interface MigrationOptions {
  localOwnerId: string;
  userId: string;
  localRecords: Record[];
  localGoals: Goal[];
  option: "transfer" | "server_only" | "merge";
}

/**
 * Option 1: 로컬 기록을 서버로 이전
 */
export async function migrateTransfer({
  localRecords,
  userId,
}: MigrationOptions) {
  const results = {
    success: 0,
    failed: 0,
    errors: [] as string[],
  };

  for (const record of localRecords) {
    try {
      const response = await fetch("/api/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...record,
          user_id: userId,
          local_id: record.id,  // 로컬 ID 추적
        }),
      });

      if (!response.ok) {
        results.failed++;
        results.errors.push(
          `Failed to migrate record ${record.id}`
        );
      } else {
        results.success++;
      }
    } catch (error) {
      results.failed++;
      results.errors.push(
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  return results;
}

/**
 * Option 3: 데이터 병합
 */
export async function migrateMerge({
  localOwnerId,
  userId,
  localRecords,
  option,
}: MigrationOptions) {
  // 1. 로컬 기록을 서버로 전송
  const transferResults = await migrateTransfer({
    localOwnerId,
    userId,
    localRecords,
    localGoals: [],
    option: "transfer",
  });

  // 2. 서버 기록을 로컬로 다운로드
  const serverResponse = await fetch("/api/records");
  const { records: serverRecords } = await serverResponse.json();

  // 3. IndexedDB에 서버 레코드 추가
  for (const record of serverRecords) {
    // 로컬에서 이미 있는지 확인
    // 있으면 건너뛰고, 없으면 추가
  }

  return {
    transferred: transferResults.success,
    synced: serverRecords.length,
    errors: transferResults.errors,
  };
}

/**
 * 마이그레이션 상태 조회
 */
export async function getMigrationStatus(userId: string) {
  try {
    const response = await fetch("/api/sync-status", {
      headers: {
        "Authorization": `Bearer ${localStorage.getItem("auth_token")}`,
      },
    });

    return await response.json();
  } catch (error) {
    return null;
  }
}
```

---

## Part 4. 동기화 전략

### hooks/useSyncData.ts

```typescript
import { useEffect, useRef } from "react";
import { useRecordStore } from "@/stores/useRecordStore";
import { useAuthStore } from "@/stores/useAuthStore";

/**
 * 로컬 ↔ 서버 동기화 훅
 */
export const useSyncData = () => {
  const { isAuthenticated } = useAuthStore();
  const { records, syncLocalToServer } = useRecordStore();
  const syncTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!isAuthenticated) return;

    // 기록이 변경되면 3초 후 동기화
    syncTimeoutRef.current = setTimeout(() => {
      syncLocalToServer(useAuthStore.getState().localOwnerId!);
    }, 3000);

    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [records, isAuthenticated, syncLocalToServer]);

  // 온라인/오프라인 감지
  useEffect(() => {
    const handleOnline = () => {
      // 온라인 복귀 시 동기화
      if (isAuthenticated) {
        syncLocalToServer(useAuthStore.getState().localOwnerId!);
      }
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [isAuthenticated, syncLocalToServer]);
};
```

---

## Part 5. 성능 최적화

### React Query 설정

```typescript
// lib/api/queryClient.ts

import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,  // 5분
      gcTime: 1000 * 60 * 10,    // 10분
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});
```

### 데이터 페칭 훅

```typescript
// hooks/useRecords.ts

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./useAuth";

export const useRecords = (startDate?: string, endDate?: string) => {
  const auth = useAuth();

  return useQuery({
    queryKey: ["records", startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.append("start_date", startDate);
      if (endDate) params.append("end_date", endDate);

      const response = await fetch(`/api/records?${params}`);
      if (!response.ok) throw new Error("Failed to fetch records");
      return response.json();
    },
    enabled: auth.isAuthenticated,
  });
};
```
