-- =========================================================
-- FPL Insights — v1 schema (Supabase / Postgres)
--
-- Scope: read-only insights app. No auth, no per-user tables.
-- Every row here is a shared snapshot synced from the public
-- FPL API (bootstrap-static, fixtures, event/{gw}/live,
-- element-summary). Personalization (linking a manager's own
-- team by FPL entry ID) is phase 2 and is NOT in this schema.
--
-- Refresh the materialized views at the bottom after every
-- sync run — commands are noted at the end of the file.
-- =========================================================

-- ---------------------------------------------------------
-- 1. Teams
-- ---------------------------------------------------------

create table if not exists teams (
    id                     integer primary key,          -- FPL team id
    name                   text not null,
    short_name             text not null,
    strength               integer,
    strength_overall_home  integer,
    strength_overall_away  integer,
    strength_attack_home   integer,
    strength_attack_away   integer,
    strength_defence_home  integer,
    strength_defence_away  integer,
    updated_at             timestamptz not null default now()
);

-- ---------------------------------------------------------
-- 2. Players — current-season snapshot, upserted on every sync
-- ---------------------------------------------------------

create table if not exists players (
    id                              integer primary key,   -- FPL element id
    first_name                     text,
    second_name                    text,
    web_name                       text not null,
    team_id                        integer not null references teams(id),
    element_type                   smallint not null,      -- 1 GKP, 2 DEF, 3 MID, 4 FWD
    now_cost                       integer not null,       -- tenths of a million, e.g. 55 = £5.5m
    status                         text,                    -- a=available, i=injured, d=doubtful, s=suspended, u=unavailable
    news                           text,
    news_added                     timestamptz,
    chance_of_playing_next_round   smallint,

    selected_by_percent            numeric,
    form                           numeric,
    points_per_game                numeric,
    total_points                   integer default 0,
    minutes                        integer default 0,
    starts                         integer default 0,

    goals_scored                   integer default 0,
    assists                        integer default 0,
    clean_sheets                   integer default 0,
    goals_conceded                 integer default 0,
    own_goals                      integer default 0,
    penalties_saved                integer default 0,
    penalties_missed               integer default 0,
    yellow_cards                   integer default 0,
    red_cards                      integer default 0,
    saves                          integer default 0,
    bonus                          integer default 0,
    bps                            integer default 0,

    influence                      numeric,
    creativity                     numeric,
    threat                         numeric,
    ict_index                      numeric,

    expected_goals                 numeric default 0,
    expected_assists                numeric default 0,
    expected_goal_involvements     numeric default 0,
    expected_goals_conceded         numeric default 0,

    defensive_contribution          integer default 0,
    defensive_contribution_per_90   numeric default 0,

    transfers_in                   integer default 0,
    transfers_out                  integer default 0,
    transfers_in_event             integer default 0,
    transfers_out_event            integer default 0,

    updated_at                     timestamptz not null default now()
);

create index if not exists idx_players_team on players(team_id);
create index if not exists idx_players_element_type on players(element_type);
create index if not exists idx_players_ownership on players(selected_by_percent);

comment on table players is 'Current-season snapshot per player. Overwritten (upsert by id) on every sync — not a history table.';

-- ---------------------------------------------------------
-- 3. Gameweeks
-- ---------------------------------------------------------

create table if not exists gameweeks (
    id                    integer primary key,           -- FPL event id (gameweek number)
    name                  text not null,
    deadline_time         timestamptz not null,
    finished              boolean not null default false,
    is_current            boolean not null default false,
    is_next               boolean not null default false,
    is_previous           boolean not null default false,
    average_entry_score   integer,
    highest_score         integer,
    most_selected         integer references players(id),
    most_transferred_in   integer references players(id),
    most_captained        integer references players(id),
    most_vice_captained   integer references players(id),
    top_element           integer references players(id),
    top_element_points    integer,
    updated_at            timestamptz not null default now()
);

-- ---------------------------------------------------------
-- 4. Fixtures
-- ---------------------------------------------------------

create table if not exists fixtures (
    id                    integer primary key,           -- FPL fixture id
    gameweek_id           integer references gameweeks(id),
    team_h                integer not null references teams(id),
    team_a                integer not null references teams(id),
    team_h_score          integer,
    team_a_score          integer,
    team_h_difficulty     integer,
    team_a_difficulty     integer,
    kickoff_time          timestamptz,
    finished              boolean not null default false,
    started               boolean not null default false,
    updated_at            timestamptz not null default now()
);

create index if not exists idx_fixtures_gameweek on fixtures(gameweek_id);
create index if not exists idx_fixtures_team_h on fixtures(team_h);
create index if not exists idx_fixtures_team_a on fixtures(team_a);
create index if not exists idx_fixtures_kickoff on fixtures(kickoff_time);

-- ---------------------------------------------------------
-- 5. Player gameweek stats — the archive table
--    One row per player per FIXTURE (not per gameweek), so
--    double gameweeks (two fixtures, same gameweek) and blank
--    gameweeks (zero fixtures) both fall out naturally.
--    This is what every insight below is computed from — FPL
--    itself doesn't keep a queryable history once a season
--    moves on, so this table is the only long-term record.
-- ---------------------------------------------------------

create table if not exists player_gw_stats (
    id                          bigint generated always as identity primary key,
    player_id                  integer not null references players(id),
    fixture_id                 integer not null references fixtures(id),
    gameweek_id                integer not null references gameweeks(id),
    was_home                   boolean,
    opponent_team_id           integer references teams(id),

    minutes                    integer default 0,
    total_points                integer default 0,
    starts                     smallint default 0,

    goals_scored                integer default 0,
    assists                     integer default 0,
    clean_sheets                integer default 0,
    goals_conceded               integer default 0,
    own_goals                   integer default 0,
    penalties_saved              integer default 0,
    penalties_missed            integer default 0,
    yellow_cards                integer default 0,
    red_cards                   integer default 0,
    saves                       integer default 0,
    bonus                       integer default 0,
    bps                         integer default 0,

    influence                   numeric,
    creativity                  numeric,
    threat                      numeric,
    ict_index                   numeric,

    expected_goals               numeric default 0,
    expected_assists             numeric default 0,
    expected_goal_involvements   numeric default 0,
    expected_goals_conceded       numeric default 0,

    defensive_contribution        integer default 0,

    value                        integer,     -- player price at the time, tenths of a million
    selected                     integer,     -- ownership count at the time

    created_at                  timestamptz not null default now(),

    unique (player_id, fixture_id)
);

create index if not exists idx_pgw_player on player_gw_stats(player_id);
create index if not exists idx_pgw_gameweek on player_gw_stats(gameweek_id);
create index if not exists idx_pgw_fixture on player_gw_stats(fixture_id);

comment on table player_gw_stats is 'Historical archive, one row per player per fixture played. Never overwritten — this is the season''s permanent record.';

-- ---------------------------------------------------------
-- 6. Daily player snapshot — raw log for future price-change
--    modeling (phase 1b). Cheap to write now; can''t be
--    backfilled later since FPL only exposes current values.
-- ---------------------------------------------------------

create table if not exists daily_player_snapshot (
    id                    bigint generated always as identity primary key,
    player_id             integer not null references players(id),
    snapshot_date         date not null,
    now_cost              integer not null,
    selected_by_percent   numeric,
    form                  numeric,
    transfers_in_event    integer default 0,
    transfers_out_event   integer default 0,
    net_transfers_event   integer generated always as (transfers_in_event - transfers_out_event) stored,
    created_at            timestamptz not null default now(),
    unique (player_id, snapshot_date)
);

create index if not exists idx_dps_player_date on daily_player_snapshot(player_id, snapshot_date);

-- ---------------------------------------------------------
-- 7. Derived view — recent price changes
--    (No separate log table needed; it's just yesterday vs
--    today on the daily snapshot.)
-- ---------------------------------------------------------

create or replace view v_recent_price_changes as
select
    curr.player_id,
    curr.snapshot_date,
    prev.now_cost as previous_price,
    curr.now_cost  as current_price,
    (curr.now_cost - prev.now_cost) as change,
    curr.net_transfers_event
from daily_player_snapshot curr
join daily_player_snapshot prev
    on prev.player_id = curr.player_id
    and prev.snapshot_date = curr.snapshot_date - interval '1 day'
where curr.now_cost <> prev.now_cost;

-- ---------------------------------------------------------
-- 8. Materialized view — DEFCON hit rate
--    % of appearances where a player actually clears their
--    position's defensive-contribution threshold (10 for
--    defenders, 12 for midfielders/forwards). This is the
--    stat the official app doesn't surface at all.
-- ---------------------------------------------------------

create materialized view if not exists mv_defcon_hit_rate as
with appearances as (
    select
        pg.player_id,
        p.web_name,
        p.team_id,
        p.element_type,
        p.now_cost,
        pg.defensive_contribution,
        case when p.element_type = 2 then 10 else 12 end as threshold
    from player_gw_stats pg
    join players p on p.id = pg.player_id
    where pg.minutes > 0
      and p.element_type in (2, 3, 4)   -- DEFCON doesn't apply to goalkeepers
)
select
    player_id,
    web_name,
    team_id,
    element_type,
    now_cost,
    count(*)                                                               as appearances,
    round(avg(defensive_contribution), 2)                                  as avg_actions_per_appearance,
    round(avg(case when defensive_contribution >= threshold then 1.0 else 0 end), 4) as hit_rate,
    sum(case when defensive_contribution >= threshold then 1 else 0 end)   as hits
from appearances
group by player_id, web_name, team_id, element_type, now_cost;

create unique index if not exists idx_mv_defcon_player on mv_defcon_hit_rate(player_id);

-- ---------------------------------------------------------
-- 9. Materialized view — fixture swing
--    Rolling average difficulty over the next 3/5/8 fixtures
--    per team, so upcoming easy/hard runs show up before the
--    ownership market reacts to them.
-- ---------------------------------------------------------

create materialized view if not exists mv_fixture_swing as
with upcoming as (
    select team_h as team_id, kickoff_time, team_h_difficulty as difficulty
    from fixtures where finished = false
    union all
    select team_a as team_id, kickoff_time, team_a_difficulty as difficulty
    from fixtures where finished = false
),
ranked as (
    select
        team_id,
        difficulty,
        row_number() over (partition by team_id order by kickoff_time) as rn
    from upcoming
)
select
    team_id,
    round(avg(difficulty) filter (where rn <= 3), 2) as avg_difficulty_next_3,
    round(avg(difficulty) filter (where rn <= 5), 2) as avg_difficulty_next_5,
    round(avg(difficulty) filter (where rn <= 8), 2) as avg_difficulty_next_8,
    now()                                              as computed_at
from ranked
group by team_id;

create unique index if not exists idx_mv_fixture_swing_team on mv_fixture_swing(team_id);

-- ---------------------------------------------------------
-- 10. Materialized view — differential score
--     A single sortable number combining: low ownership,
--     xGI over/under-performance, BPS banked vs points paid
--     out, and DEFCON hit rate (where relevant to position).
--     Weights are a v1 heuristic — tune freely once you have
--     a season of data to check it against.
-- ---------------------------------------------------------

create materialized view if not exists mv_differential_score as
with season_stats as (
    select
        player_id,
        sum(expected_goal_involvements) as total_xgi,
        sum(goals_scored + assists)     as total_gi,
        sum(bps)                        as total_bps,
        sum(total_points)               as total_points
    from player_gw_stats
    group by player_id
),
base as (
    select
        p.id as player_id,
        p.web_name,
        p.team_id,
        p.element_type,
        p.now_cost,
        p.selected_by_percent,
        coalesce(s.total_gi - s.total_xgi, 0) as gi_minus_xgi,   -- negative = due a return
        coalesce(s.total_bps, 0)              as total_bps,
        coalesce(s.total_points, 0)           as total_points,
        coalesce(d.hit_rate, 0)               as defcon_hit_rate
    from players p
    left join season_stats s on s.player_id = p.id
    left join mv_defcon_hit_rate d on d.player_id = p.id
    where p.minutes > 0
),
scored as (
    select
        *,
        (1 - percent_rank() over (order by selected_by_percent))                        as ownership_pctile,
        percent_rank() over (order by (total_bps::numeric / greatest(total_points, 1))) as bps_gap_pctile,
        percent_rank() over (order by (-1 * gi_minus_xgi))                              as xgi_pctile,
        case when element_type in (2, 3, 4)
             then percent_rank() over (order by defcon_hit_rate)
             else 0.5
        end as defcon_pctile
    from base
)
select
    player_id,
    web_name,
    team_id,
    element_type,
    now_cost,
    selected_by_percent,
    round(
        (
            (0.35 * ownership_pctile) +
            (0.25 * xgi_pctile) +
            (0.20 * bps_gap_pctile) +
            (0.20 * defcon_pctile)
        )::numeric
    , 4) as differential_score,
    ownership_pctile,
    xgi_pctile,
    bps_gap_pctile,
    defcon_pctile,
    now() as computed_at
from scored;

create unique index if not exists idx_mv_diff_score_player on mv_differential_score(player_id);

-- ---------------------------------------------------------
-- 11. Helper function — refreshes all three insight views in
--     the correct dependency order (mv_differential_score reads
--     from mv_defcon_hit_rate, so it must go last). The sync
--     script calls this via supabase.rpc('refresh_fpl_insight_views')
--     after the history job runs.
-- ---------------------------------------------------------

create or replace function refresh_fpl_insight_views()
returns void
language plpgsql
as $$
begin
    refresh materialized view concurrently mv_defcon_hit_rate;
    refresh materialized view concurrently mv_fixture_swing;
    refresh materialized view concurrently mv_differential_score;
end;
$$;

-- ---------------------------------------------------------
-- 12. Sync status — one row per job ("fast", "history").
--     Read by the frontend to show "last refreshed at", and
--     by the refresh-fast Netlify Function to enforce a
--     cooldown between runs so overlapping clicks don't fire
--     duplicate syncs.
-- ---------------------------------------------------------

create table if not exists sync_status (
    job               text primary key,
    last_started_at   timestamptz,
    last_finished_at  timestamptz,
    last_success      boolean,
    last_error        text,
    teams_synced      integer,
    players_synced    integer,
    fixtures_synced   integer
);

-- ---------------------------------------------------------
-- 13. Public access — no RLS, anon has full read/write.
--
--     RLS is off, and the anon key (used directly by the
--     frontend) has full select/insert/update/delete on every
--     table below. That key ships inside public/index.html and
--     is visible to anyone who views the page source, so this
--     means full read/write access for anyone who finds the
--     site, not just the app's own frontend. Confirmed
--     intentional — revisit if this app is ever shared beyond
--     a small trusted group.
-- ---------------------------------------------------------

alter table teams disable row level security;
alter table players disable row level security;
alter table gameweeks disable row level security;
alter table fixtures disable row level security;
alter table player_gw_stats disable row level security;
alter table daily_player_snapshot disable row level security;
alter table sync_status disable row level security;

drop policy if exists "Public read access" on teams;
drop policy if exists "Public read access" on players;
drop policy if exists "Public read access" on gameweeks;
drop policy if exists "Public read access" on fixtures;
drop policy if exists "Public read access" on player_gw_stats;
drop policy if exists "Public read access" on daily_player_snapshot;
drop policy if exists "Public read access" on sync_status;

grant select, insert, update, delete on
    teams, players, gameweeks, fixtures, player_gw_stats,
    daily_player_snapshot, sync_status
to anon, authenticated;

-- Materialized views can't accept writes in Postgres regardless
-- of grants (INSERT/UPDATE/DELETE against one is always
-- rejected), so these stay read-only no matter what.
grant select on mv_defcon_hit_rate, mv_fixture_swing, mv_differential_score,
    v_recent_price_changes to anon, authenticated;
