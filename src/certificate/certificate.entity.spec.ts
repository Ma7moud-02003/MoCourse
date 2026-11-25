import { getMetadataArgsStorage } from 'typeorm';
import { CertificateEntity } from './certificate.entity';
import { CourseEntity } from 'src/course/course.entity';
import { UserEntity } from 'src/User/user.entity';

describe('CertificateEntity relations', () => {
  const rel = (name: string) =>
    getMetadataArgsStorage().relations.find(
      (r) => r.target === CertificateEntity && r.propertyName === name,
    );

  it('course points at CourseEntity, not UserEntity', () => {
    const r: any = rel('course');
    expect(r).toBeDefined();
    const target = typeof r.type === 'function' ? r.type() : r.type;
    expect(target).toBe(CourseEntity);
  });

  it('student still points at UserEntity', () => {
    const r: any = rel('student');
    const target = typeof r.type === 'function' ? r.type() : r.type;
    expect(target).toBe(UserEntity);
  });

  it('one certificate per student per course is a database unique rule', () => {
    const u = getMetadataArgsStorage().uniques.find(
      (x: any) => x.target === CertificateEntity && x.name === 'UQ_certificates_student_course',
    ) as any;
    expect(u).toBeDefined();
    expect(u.columns).toEqual(expect.arrayContaining(['student', 'course']));
  });
});
