# SQL Bonus Section

Answers to the bonus SQL section of the assessment. Two source tables:

- `emp_designation_log`: one row per designation change for an employee
  (`emp_id`, `emp_name`, `designation`, `effective_date`)
- `emp_allocation_log`: one row per project allocation
  (`allocation_id`, `emp_id`, `project_name`, `allocated_role`,
  `allocation_start`, `allocation_end`)

There's no foreign key between the two tables, so everything below is derived
purely from comparing dates.

---

## Q1: Current designation per employee

**Ask**: return every employee's current designation, meaning the one from their
most recent `effective_date`.

```sql
SELECT d.emp_id, d.emp_name, d.designation AS current_designation
FROM emp_designation_log d
WHERE d.effective_date = (
    SELECT MAX(d2.effective_date)
    FROM emp_designation_log d2
    WHERE d2.emp_id = d.emp_id
);
```

**Reasoning**: a correlated subquery finds each employee's latest `effective_date`,
and the outer query keeps only the row (or rows) matching that date.

**Caveat**: a few employees in the sample data (Carol Smith, Frank Patel, Henry
Walsh) have two rows with the exact same `effective_date`. This query would return
both rows for those employees instead of picking one. If a single row per employee
is required no matter what, the window-function version below handles it more
reliably:

```sql
SELECT emp_id, emp_name, designation AS current_designation
FROM (
    SELECT
        emp_id, emp_name, designation,
        ROW_NUMBER() OVER (
            PARTITION BY emp_id
            ORDER BY effective_date DESC, txn_id DESC
        ) AS rn
    FROM emp_designation_log
) ranked
WHERE rn = 1;
```

Ordering by `txn_id DESC` as a tiebreaker assumes a higher transaction id was
recorded later. That's a reasonable assumption for a table that's tracking a
change log, but it's worth saying out loud since the data itself doesn't otherwise
tell you which same-day change came first.

---

## Q2: Designation timeline (previous / next per row)

**Ask**: for every row, return `previous_designation` and `next_designation`
relative to that row, per employee, with `NULL` where there isn't a previous or
next one.

```sql
SELECT
    emp_id,
    effective_date,
    LAG(designation)  OVER (PARTITION BY emp_id ORDER BY effective_date, txn_id) AS previous_designation,
    designation,
    LEAD(designation) OVER (PARTITION BY emp_id ORDER BY effective_date, txn_id) AS next_designation
FROM emp_designation_log
ORDER BY emp_id, effective_date;
```

**Reasoning**: `LAG`/`LEAD` do exactly this, "the row before or after this one
within a group." `PARTITION BY emp_id` keeps each employee's timeline separate, and
`ORDER BY effective_date` defines what "previous" and "next" actually mean. `NULL`
comes out naturally at the start and end of each employee's own timeline, which
matches what the spec asks for.

**Tiebreaker note**: Henry Walsh has two designation rows on the same
`effective_date` (2024-06-01, `T022`/`T023`) with different designations. Ordering
by `effective_date` alone leaves no defined order between those two rows, so
whether `LAG`/`LEAD` treats one as "previous" versus "next" would come down to
chance. Adding `txn_id` as a second sort key (the same tiebreaker used in Q1 and Q4)
fixes that, on the same assumption that a higher `txn_id` means it was recorded
later.

---

## Q4: Designation at time of allocation

**Ask**: for every allocation, work out what designation the employee held on
`allocation_start`, meaning the designation whose `effective_date` is the latest
one on or before that date. If there's no designation record before the
allocation started at all, that gap should show up rather than get silently
dropped.

```sql
SELECT
    a.allocation_id,
    a.emp_id,
    d.emp_name,
    a.project_name,
    a.allocated_role,
    a.allocation_start,
    d.designation AS designation_at_allocation
FROM emp_allocation_log a
LEFT JOIN emp_designation_log d
    ON d.emp_id = a.emp_id
    AND d.effective_date = (
        SELECT MAX(d2.effective_date)
        FROM emp_designation_log d2
        WHERE d2.emp_id = a.emp_id
          AND d2.effective_date <= a.allocation_start
    )
ORDER BY a.allocation_id;
```

`emp_name` comes from the matched designation row (`d.emp_name`), since
`emp_allocation_log` doesn't have a name column at all. One side effect of the
`LEFT JOIN`: if the subquery can't find a matching designation row for a given
allocation, `emp_name` comes back `NULL` too, not just `designation_at_allocation`.
A missing name is more noticeable than a missing designation, so it's worth
flagging if this ever actually shows up in real data (it doesn't in the sample set
given here).

**Join strategy, step by step**:

1. Start from `emp_allocation_log`, since the output is one row per allocation.
2. For each allocation, find the latest designation change that had already
   happened by `allocation_start`. That's what the correlated subquery does: among
   this employee's designation rows with `effective_date <= allocation_start`, take
   the most recent one.
3. Join that specific designation row back onto the allocation row.

**Why `LEFT JOIN` instead of `INNER JOIN`**: this is the case the spec specifically
asks you to think through, what happens if an employee has no designation record
before their `allocation_start`. With an `INNER JOIN`, that allocation would just
disappear from the results, which hides a data problem instead of showing it. With
a `LEFT JOIN`, the allocation still shows up, just with
`designation_at_allocation = NULL`, an honest signal that the data's incomplete for
that one allocation rather than an allocation quietly vanishing from the report.

**Caveat**: same tie-breaking issue as Q1. If a designation changed more than once
on the exact same date, the plain correlated subquery above doesn't distinguish
between them. A window-function version resolves it the same way Q1's alternative
does:

```sql
SELECT
    a.allocation_id,
    a.emp_id,
    ranked.emp_name,
    a.project_name,
    a.allocated_role,
    a.allocation_start,
    ranked.designation AS designation_at_allocation
FROM emp_allocation_log a
LEFT JOIN (
    SELECT
        emp_id, emp_name, designation, effective_date,
        ROW_NUMBER() OVER (PARTITION BY emp_id ORDER BY effective_date DESC, txn_id DESC) AS rn
    FROM emp_designation_log
) ranked
    ON ranked.emp_id = a.emp_id
    AND ranked.effective_date <= a.allocation_start
    AND ranked.rn = (
        SELECT MIN(r2.rn)
        FROM (
            SELECT emp_id, effective_date,
                   ROW_NUMBER() OVER (PARTITION BY emp_id ORDER BY effective_date DESC, txn_id DESC) AS rn
            FROM emp_designation_log
        ) r2
        WHERE r2.emp_id = a.emp_id AND r2.effective_date <= a.allocation_start
    )
ORDER BY a.allocation_id;
```

This is a lot more complex just to handle a tie-breaking edge case that might not
even show up in every dataset. It's included here to show the reasoning, but the
simpler correlated-subquery version above is the practical answer for this scope.
