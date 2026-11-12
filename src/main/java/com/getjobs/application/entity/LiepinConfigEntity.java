package com.getjobs.application.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("liepin_config")
public class LiepinConfigEntity {
    @TableId(type = IdType.AUTO)
    /** 主键ID */
    private Long id;

    /** 调试模式（1=开启，0=关闭） */
    private Integer debugger;

    /** 搜索关键词 */
    private String keywords;

    /** 城市（名称或代码） */
    private String city;

    /** 薪资代码或范围 */
    private String salaryCode;

    /** 公司规模筛选，括号列表（如 [100-499人,500-999人]），空表示不限 */
    private String companyScale;

    /** 打招呼语（聊一聊后续发送的自定义文案） */
    private String sayHi;

    /** 是否补发自定义招呼语（1=补发，0=只用猎聘默认招呼语） */
    private Integer sendSayHi;

    /** 同一 HR 只打一次招呼（1=开启，0=关闭） */
    private Integer sameHrFilter;

    /** 发布时间不超过多少天（0=不限，默认 90） */
    private Integer publishWithinDays;

    /** HR 最近活跃不超过多少天（0=不限，默认 30） */
    private Integer hrActiveWithinDays;

    /** 发布时间多选档位，括号列表：0-30,31-60,61-90,91-180,180+；null 表示用旧阈值 */
    private String publishAgeBuckets;

    /** HR 活跃多选档位，括号列表：now,3d,week,2w,month,3m,older；null 表示用旧阈值 */
    private String hrActiveBuckets;

    /** 创建时间 */
    private LocalDateTime createdAt;

    /** 更新时间 */
    private LocalDateTime updatedAt;
}
