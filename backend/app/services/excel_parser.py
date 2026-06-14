import pandas as pd
import numpy as np
import math
from typing import Dict, Any, List, Tuple

class ExcelParserService:
    @staticmethod
    def fuzzy_match_day(day_str: str) -> str | None:
        if not day_str or not isinstance(day_str, str):
            return None
        day_str = day_str.strip().upper()
        if "MON" in day_str:
            return "Monday"
        if "TUE" in day_str:
            return "Tuesday"
        if "WED" in day_str or "WEN" in day_str:  # Handled "WEDNEDAY"
            return "Wednesday"
        if "THU" in day_str:
            return "Thursday"
        if "FRI" in day_str:
            return "Friday"
        if "SAT" in day_str:
            return "Saturday"
        return None

    @staticmethod
    def normalize_class(class_val: Any) -> str | None:
        if pd.isna(class_val) or class_val is None:
            return None

        # Convert float/int to string
        if isinstance(class_val, (int, float)):
            if math.isnan(class_val):
                return None
            val_int = int(class_val)
            if val_int == class_val:
                return str(val_int)
            return str(class_val)

        val_str = str(class_val).strip()
        if val_str == "" or val_str == "nan":
            return None

        val_upper = val_str.upper()
        if val_upper in ["N", "NUR", "NURSERY"]:
            return "N"
        if val_upper in ["L", "LKG"]:
            return "L"
        if val_upper in ["U", "UKG"]:
            return "U"

        return val_str

    @classmethod
    def parse_timetable(cls, file_path: str) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
        """
        Parses the timetable Excel file dynamically.
        Returns:
            Tuple of (report_dict, parsed_teachers_list)
        """
        report = {
            "errors": [],
            "warnings": [],
            "success": True,
            "total_teachers": 0,
            "total_periods": 0
        }
        teachers_data = []

        try:
            xl = pd.ExcelFile(file_path)
            sheet_name = xl.sheet_names[0]
            df = xl.parse(sheet_name, header=None)
        except Exception as e:
            report["success"] = False
            report["errors"].append(f"Failed to read Excel file: {str(e)}")
            return report, []

        # Find header row index
        header_row_idx = None
        sr_col_idx = None
        teacher_col_idx = None
        ct_col_idx = None

        for r_idx, row in df.iterrows():
            row_strs = [str(val).strip().lower() if pd.notna(val) else "" for val in row]
            if any("sr." in s or "serial" in s or "no." in s for s in row_strs) and \
               any("class teacher" in s or "teacher name" in s or "teacher" in s for s in row_strs):
                header_row_idx = r_idx
                for c_idx, s in enumerate(row_strs):
                    if "sr." in s or "no." in s:
                        sr_col_idx = c_idx
                    elif "class teacher" in s or "teacher" in s:
                        teacher_col_idx = c_idx
                    elif "c.t." in s or "ct" == s:
                        ct_col_idx = c_idx
                break

        if header_row_idx is None:
            report["success"] = False
            report["errors"].append("Could not locate the header row containing 'Sr. No.' and 'Class Teacher'.")
            return report, []

        if teacher_col_idx is None:
            teacher_col_idx = 2
            report["warnings"].append("Class Teacher column not found by name, using Column 2 fallback.")
        if ct_col_idx is None:
            ct_col_idx = 3
            report["warnings"].append("C.T. column not found by name, using Column 3 fallback.")

        # Find day headers
        day_row_idx = header_row_idx - 1 if header_row_idx > 0 else 0
        day_headers = {}
        day_row = df.iloc[day_row_idx]

        for c_idx in range(teacher_col_idx + 1, len(day_row)):
            val = day_row.iloc[c_idx]
            if pd.notna(val):
                matched_day = cls.fuzzy_match_day(str(val))
                if matched_day:
                    day_headers[matched_day] = c_idx

        # Search search rows 0..header_row_idx if day_headers is empty
        if not day_headers:
            for r_search in range(min(5, header_row_idx)):
                row = df.iloc[r_search]
                for c_idx in range(teacher_col_idx + 1, len(row)):
                    val = row.iloc[c_idx]
                    if pd.notna(val):
                        matched_day = cls.fuzzy_match_day(str(val))
                        if matched_day:
                            day_headers[matched_day] = c_idx

        expected_days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
        missing_days = [d for d in expected_days if d not in day_headers]
        if missing_days:
            report["warnings"].append(f"Missing day headers in timetable: {', '.join(missing_days)}")

        sorted_day_cols = sorted(day_headers.items(), key=lambda x: x[1])
        col_to_day_period = {}

        for i, (day_name, start_col) in enumerate(sorted_day_cols):
            end_col = sorted_day_cols[i+1][1] if i + 1 < len(sorted_day_cols) else len(df.columns)
            period_num = 1
            for c_idx in range(start_col, end_col):
                p_val = df.iloc[header_row_idx, c_idx]
                if pd.notna(p_val):
                    try:
                        p_str = str(p_val).strip()
                        p_num = int(float(p_str))
                        col_to_day_period[c_idx] = (day_name, p_num)
                    except ValueError:
                        col_to_day_period[c_idx] = (day_name, period_num)
                else:
                    col_to_day_period[c_idx] = (day_name, period_num)
                period_num += 1

        if not col_to_day_period:
            report["success"] = False
            report["errors"].append("Could not map columns to periods. Verify that period numbers are listed.")
            return report, []

        # Parse teachers
        teacher_names_set = set()
        for r_idx in range(header_row_idx + 1, len(df)):
            row = df.iloc[r_idx]
            teacher_name_raw = row.iloc[teacher_col_idx] if teacher_col_idx < len(row) else None
            
            if pd.isna(teacher_name_raw) or str(teacher_name_raw).strip() == "":
                # Skip empty lines
                continue
                
            teacher_name = str(teacher_name_raw).strip()
            
            # Check duplicate
            if teacher_name in teacher_names_set:
                report["warnings"].append(f"Duplicate teacher found: '{teacher_name}' at row {r_idx + 1}.")
            teacher_names_set.add(teacher_name)

            ct_val_raw = row.iloc[ct_col_idx] if ct_col_idx < len(row) else None
            ct_class = cls.normalize_class(ct_val_raw)

            # Build teacher schedule
            schedule = {}
            for day in expected_days:
                schedule[day] = {}
                for p in range(1, 9):
                    schedule[day][p] = None

            for c_idx, (day, p_num) in col_to_day_period.items():
                if c_idx < len(row):
                    cell_val = row.iloc[c_idx]
                    if pd.notna(cell_val):
                        cell_str = str(cell_val).strip()
                        if cell_str == "" or cell_str == "nan":
                            schedule[day][p_num] = None
                        elif cell_str in ["B", "-"]:
                            if p_num >= 6 and ct_class in ["N", "L", "U", "Nursery", "LKG", "UKG"]:
                                schedule[day][p_num] = None
                            else:
                                schedule[day][p_num] = cell_str
                        else:
                            norm_val = cls.normalize_class(cell_val)
                            if p_num >= 6 and (norm_val in ["N", "L", "U", "Nursery", "LKG", "UKG"] or ct_class in ["N", "L", "U", "Nursery", "LKG", "UKG"]):
                                schedule[day][p_num] = None
                            else:
                                schedule[day][p_num] = norm_val

            teachers_data.append({
                "name": teacher_name,
                "class_teacher_of": ct_class,
                "schedule": schedule
            })

        report["total_teachers"] = len(teachers_data)
        report["total_periods"] = len(col_to_day_period)

        return report, teachers_data
